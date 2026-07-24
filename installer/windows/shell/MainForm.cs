using System.Diagnostics;
using System.Net;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace PicoDmxShell;

internal sealed class MainForm : Form
{
    private readonly Uri controllerUri;
    private readonly EventWaitHandle activateEvent;
    private readonly CancellationTokenSource activationCancellation = new();
    private readonly WebView2 webView = new WebView2();
    private readonly ToolStripStatusLabel statusLabel = new();
    private readonly MenuStrip menu = new();
    private readonly Panel fullscreenBar = new();
    private readonly NotifyIcon trayIcon;
    private FormBorderStyle previousBorderStyle;
    private FormWindowState previousWindowState;
    private bool fullscreen;
    private bool exiting;

    public MainForm(string url, EventWaitHandle activateEvent)
    {
        controllerUri = NormalizeControllerUri(url);
        this.activateEvent = activateEvent;

        Text = "Pico DMX Controller";
        StartPosition = FormStartPosition.CenterScreen;
        MinimumSize = new Size(900, 600);
        Width = 1440;
        Height = 960;
        KeyPreview = true;

        var icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        if (icon is not null)
        {
            Icon = icon;
        }

        BuildMenu();
        BuildFullscreenBar();
        BuildStatusBar();

        webView.Dock = DockStyle.Fill;
        Controls.Add(webView);
        Controls.Add(fullscreenBar);
        Controls.Add(menu);

        trayIcon = BuildTrayIcon(icon ?? SystemIcons.Application);

        Shown += async (_, _) => await InitializeBrowserAsync();
        KeyDown += HandleWindowKeyDown;
        FormClosing += HandleFormClosing;
        Resize += (_, _) => statusLabel.Text = WindowState == FormWindowState.Minimized
            ? "Application minimized; the Pico DMX server remains available."
            : statusLabel.Text;

        StartActivationListener();
    }

    private void BuildMenu()
    {
        var application = new ToolStripMenuItem("&Application");
        application.DropDownItems.Add("Open controller", null, (_, _) => NavigateHome());
        application.DropDownItems.Add("Reload", null, (_, _) => webView.Reload());
        application.DropDownItems.Add(new ToolStripSeparator());
        application.DropDownItems.Add("Exit application", null, (_, _) => ExitApplication());

        var view = new ToolStripMenuItem("&View");
        view.DropDownItems.Add("Toggle full screen", null, (_, _) => ToggleFullscreen());

        menu.Items.Add(application);
        menu.Items.Add(view);
        menu.Dock = DockStyle.Top;
    }

    private void BuildFullscreenBar()
    {
        fullscreenBar.Dock = DockStyle.Top;
        fullscreenBar.Height = 44;
        fullscreenBar.BackColor = Color.FromArgb(24, 28, 36);
        fullscreenBar.Visible = false;

        var exitFullscreen = new Button
        {
            Text = "Exit full screen",
            AutoSize = true,
            Height = 32,
            Left = 10,
            Top = 6
        };
        exitFullscreen.Click += (_, _) => ToggleFullscreen();

        var close = new Button
        {
            Text = "Close application",
            AutoSize = true,
            Height = 32,
            Top = 6,
            Anchor = AnchorStyles.Top | AnchorStyles.Right
        };
        close.Left = fullscreenBar.Width - close.Width - 10;
        fullscreenBar.Resize += (_, _) => close.Left = fullscreenBar.Width - close.Width - 10;
        close.Click += (_, _) => ExitApplication();

        fullscreenBar.Controls.Add(exitFullscreen);
        fullscreenBar.Controls.Add(close);
    }

    private void BuildStatusBar()
    {
        var status = new StatusStrip();
        statusLabel.Text = "Waiting for the Pico DMX server…";
        status.Items.Add(statusLabel);
        Controls.Add(status);
    }

    private NotifyIcon BuildTrayIcon(Icon icon)
    {
        var context = new ContextMenuStrip();
        context.Items.Add("Open", null, (_, _) => RestoreWindow());
        context.Items.Add("Toggle full screen", null, (_, _) =>
        {
            RestoreWindow();
            ToggleFullscreen();
        });
        context.Items.Add(new ToolStripSeparator());
        context.Items.Add("Exit application", null, (_, _) => ExitApplication());

        var notifyIcon = new NotifyIcon
        {
            Icon = icon,
            Text = "Pico DMX Controller",
            Visible = true,
            ContextMenuStrip = context
        };
        notifyIcon.DoubleClick += (_, _) => RestoreWindow();
        return notifyIcon;
    }

    private async Task InitializeBrowserAsync()
    {
        statusLabel.Text = "Starting Pico DMX Controller…";
        if (!await WaitForServerAsync(controllerUri, TimeSpan.FromSeconds(20)))
        {
            statusLabel.Text = "The local server did not answer. Retrying in the browser…";
        }

        try
        {
            var userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Pico DMX Controller",
                "WebView2");
            Directory.CreateDirectory(userDataFolder);
            var environment = await CoreWebView2Environment.CreateAsync(
                browserExecutableFolder: null,
                userDataFolder: userDataFolder);
            await webView.EnsureCoreWebView2Async(environment);
            webView.CoreWebView2.Settings.AreDevToolsEnabled = false;
            webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            webView.CoreWebView2.NavigationStarting += (_, _) =>
                statusLabel.Text = "Loading…";
            webView.CoreWebView2.NavigationCompleted += (_, eventArgs) =>
                statusLabel.Text = eventArgs.IsSuccess
                    ? "Ready — closing this window leaves the Pico DMX server running."
                    : $"Page load failed: {eventArgs.WebErrorStatus}";
            NavigateHome();
        }
        catch (Exception exception)
        {
            statusLabel.Text = "WebView2 is unavailable; opening the default browser.";
            LaunchFallbackBrowser();
            MessageBox.Show(
                this,
                "The native application window could not start WebView2, so the controller was opened in your default browser.\r\n\r\n" +
                exception.Message,
                "Pico DMX Controller",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
            ExitApplication();
        }
    }

    private void NavigateHome()
    {
        if (webView.CoreWebView2 is not null)
        {
            webView.CoreWebView2.Navigate(controllerUri.AbsoluteUri);
        }
    }

    private static async Task<bool> WaitForServerAsync(Uri uri, TimeSpan timeout)
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
        var deadline = DateTime.UtcNow + timeout;
        while (DateTime.UtcNow < deadline)
        {
            try
            {
                using var response = await client.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead);
                if (response.StatusCode is >= HttpStatusCode.OK and < HttpStatusCode.InternalServerError)
                {
                    return true;
                }
            }
            catch (HttpRequestException)
            {
            }
            catch (TaskCanceledException)
            {
            }
            await Task.Delay(400);
        }
        return false;
    }

    private static Uri NormalizeControllerUri(string value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            return new Uri("http://localhost:8090/");
        }
        return uri;
    }

    private void LaunchFallbackBrowser()
    {
        try
        {
            Process.Start(new ProcessStartInfo(controllerUri.AbsoluteUri)
            {
                UseShellExecute = true
            });
        }
        catch
        {
            // The warning shown by the caller is sufficient if no URL handler exists.
        }
    }

    private void HandleWindowKeyDown(object? sender, KeyEventArgs eventArgs)
    {
        if (eventArgs.KeyCode == Keys.F11)
        {
            ToggleFullscreen();
            eventArgs.Handled = true;
        }
        else if (eventArgs.KeyCode == Keys.Escape && fullscreen)
        {
            ToggleFullscreen();
            eventArgs.Handled = true;
        }
    }

    private void ToggleFullscreen()
    {
        if (!fullscreen)
        {
            previousBorderStyle = FormBorderStyle;
            previousWindowState = WindowState;
            FormBorderStyle = FormBorderStyle.None;
            WindowState = FormWindowState.Maximized;
            menu.Visible = false;
            fullscreenBar.Visible = true;
            fullscreen = true;
        }
        else
        {
            fullscreenBar.Visible = false;
            menu.Visible = true;
            FormBorderStyle = previousBorderStyle;
            WindowState = previousWindowState;
            fullscreen = false;
        }
    }

    private void RestoreWindow()
    {
        if (InvokeRequired)
        {
            BeginInvoke(RestoreWindow);
            return;
        }
        Show();
        WindowState = FormWindowState.Normal;
        Activate();
        BringToFront();
    }

    private void StartActivationListener()
    {
        _ = Task.Run(() =>
        {
            while (!activationCancellation.IsCancellationRequested)
            {
                if (activateEvent.WaitOne(500))
                {
                    RestoreWindow();
                }
            }
        });
    }

    private void ExitApplication()
    {
        exiting = true;
        Close();
    }

    private void HandleFormClosing(object? sender, FormClosingEventArgs eventArgs)
    {
        exiting = true;
        activationCancellation.Cancel();
        activateEvent.Set();
        trayIcon.Visible = false;
        trayIcon.Dispose();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            if (!exiting)
            {
                trayIcon.Visible = false;
                trayIcon.Dispose();
            }
            activationCancellation.Dispose();
            webView.Dispose();
        }
        base.Dispose(disposing);
    }
}
