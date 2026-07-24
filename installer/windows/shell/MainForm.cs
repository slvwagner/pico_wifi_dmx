using System.Diagnostics;
using System.Net;
using System.Runtime.InteropServices;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace PicoDmxShell;

internal sealed class MainForm : Form
{
    private enum ControllerServiceState
    {
        Unknown,
        Missing,
        Stopped,
        Running,
        Other
    }

    private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
    private const int DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1 = 19;
    private static readonly Color ShellBackground = Color.FromArgb(18, 22, 29);
    private static readonly Color SurfaceBackground = Color.FromArgb(28, 33, 42);
    private static readonly Color HoverBackground = Color.FromArgb(48, 58, 72);
    private static readonly Color ShellForeground = Color.FromArgb(230, 235, 242);
    private static readonly ToolStripProfessionalRenderer DarkRenderer =
        new ToolStripProfessionalRenderer(new DarkColorTable());

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
    private bool closeInProgress;

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
        BackColor = ShellBackground;
        ForeColor = ShellForeground;

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

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(
        IntPtr windowHandle,
        int attribute,
        ref int attributeValue,
        int attributeSize);

    protected override void OnHandleCreated(EventArgs eventArgs)
    {
        base.OnHandleCreated(eventArgs);
        ApplyDarkWindowFrame();
    }

    private void ApplyDarkWindowFrame()
    {
        if (!OperatingSystem.IsWindows())
        {
            return;
        }

        var enabled = 1;
        try
        {
            var result = DwmSetWindowAttribute(
                Handle,
                DWMWA_USE_IMMERSIVE_DARK_MODE,
                ref enabled,
                sizeof(int));
            if (result != 0)
            {
                DwmSetWindowAttribute(
                    Handle,
                    DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1,
                    ref enabled,
                    sizeof(int));
            }
        }
        catch (DllNotFoundException)
        {
            // Very old Windows versions keep their system-default title bar.
        }
    }

    private void BuildMenu()
    {
        var application = new ToolStripMenuItem("&Application");
        application.DropDownItems.Add("Open controller", null, (_, _) => NavigateHome());
        application.DropDownItems.Add("Reload", null, (_, _) => webView.Reload());
        application.DropDownItems.Add(new ToolStripSeparator());
        application.DropDownItems.Add("Exit and stop server", null, (_, _) => ExitApplication());

        var view = new ToolStripMenuItem("&View");
        view.DropDownItems.Add("Toggle full screen", null, (_, _) => ToggleFullscreen());

        menu.Items.Add(application);
        menu.Items.Add(view);
        menu.Dock = DockStyle.Top;
        menu.Renderer = DarkRenderer;
        menu.BackColor = SurfaceBackground;
        menu.ForeColor = ShellForeground;
        StyleMenuItem(application);
        StyleMenuItem(view);
    }

    private static void StyleMenuItem(ToolStripMenuItem menuItem)
    {
        menuItem.BackColor = SurfaceBackground;
        menuItem.ForeColor = ShellForeground;
        menuItem.DropDown.BackColor = SurfaceBackground;
        menuItem.DropDown.ForeColor = ShellForeground;
        foreach (ToolStripItem child in menuItem.DropDownItems)
        {
            child.BackColor = SurfaceBackground;
            child.ForeColor = ShellForeground;
            if (child is ToolStripMenuItem childMenu)
            {
                StyleMenuItem(childMenu);
            }
        }
    }

    private void BuildFullscreenBar()
    {
        fullscreenBar.Dock = DockStyle.Top;
        fullscreenBar.Height = 44;
        fullscreenBar.BackColor = SurfaceBackground;
        fullscreenBar.Visible = false;

        var exitFullscreen = new Button
        {
            Text = "Exit full screen",
            AutoSize = true,
            Height = 32,
            Left = 10,
            Top = 6,
            FlatStyle = FlatStyle.Flat,
            BackColor = HoverBackground,
            ForeColor = ShellForeground
        };
        exitFullscreen.FlatAppearance.BorderColor = HoverBackground;
        exitFullscreen.Click += (_, _) => ToggleFullscreen();

        var close = new Button
        {
            Text = "Stop server and close",
            AutoSize = true,
            Height = 32,
            Top = 6,
            Anchor = AnchorStyles.Top | AnchorStyles.Right,
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(116, 42, 49),
            ForeColor = ShellForeground
        };
        close.FlatAppearance.BorderColor = Color.FromArgb(145, 54, 62);
        close.Left = fullscreenBar.Width - close.Width - 10;
        fullscreenBar.Resize += (_, _) => close.Left = fullscreenBar.Width - close.Width - 10;
        close.Click += (_, _) => ExitApplication();

        fullscreenBar.Controls.Add(exitFullscreen);
        fullscreenBar.Controls.Add(close);
    }

    private void BuildStatusBar()
    {
        var status = new StatusStrip();
        status.Renderer = DarkRenderer;
        status.BackColor = SurfaceBackground;
        status.ForeColor = ShellForeground;
        statusLabel.Text = "Waiting for the Pico DMX server…";
        statusLabel.ForeColor = ShellForeground;
        status.Items.Add(statusLabel);
        Controls.Add(status);
    }

    private NotifyIcon BuildTrayIcon(Icon icon)
    {
        var context = new ContextMenuStrip();
        context.Renderer = DarkRenderer;
        context.BackColor = SurfaceBackground;
        context.ForeColor = ShellForeground;
        context.Items.Add("Open", null, (_, _) => RestoreWindow());
        context.Items.Add("Toggle full screen", null, (_, _) =>
        {
            RestoreWindow();
            ToggleFullscreen();
        });
        context.Items.Add(new ToolStripSeparator());
        context.Items.Add("Exit and stop server", null, (_, _) => ExitApplication());

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

    private sealed class DarkColorTable : ProfessionalColorTable
    {
        public override Color MenuStripGradientBegin => SurfaceBackground;
        public override Color MenuStripGradientEnd => SurfaceBackground;
        public override Color ToolStripGradientBegin => SurfaceBackground;
        public override Color ToolStripGradientMiddle => SurfaceBackground;
        public override Color ToolStripGradientEnd => SurfaceBackground;
        public override Color ToolStripDropDownBackground => SurfaceBackground;
        public override Color ImageMarginGradientBegin => SurfaceBackground;
        public override Color ImageMarginGradientMiddle => SurfaceBackground;
        public override Color ImageMarginGradientEnd => SurfaceBackground;
        public override Color MenuItemSelected => HoverBackground;
        public override Color MenuItemSelectedGradientBegin => HoverBackground;
        public override Color MenuItemSelectedGradientEnd => HoverBackground;
        public override Color MenuItemPressedGradientBegin => HoverBackground;
        public override Color MenuItemPressedGradientMiddle => HoverBackground;
        public override Color MenuItemPressedGradientEnd => HoverBackground;
        public override Color MenuItemBorder => Color.FromArgb(74, 88, 106);
        public override Color MenuBorder => Color.FromArgb(74, 88, 106);
        public override Color SeparatorDark => Color.FromArgb(74, 88, 106);
        public override Color SeparatorLight => SurfaceBackground;
    }

    private async Task InitializeBrowserAsync()
    {
        statusLabel.Text = "Starting Pico DMX Controller…";
        if (!await EnsureControllerServiceRunningAsync())
        {
            statusLabel.Text = "The Pico DMX server is stopped.";
            return;
        }

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
                    ? "Ready — closing this window also stops the Pico DMX server."
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
        }
    }

    private async Task<bool> EnsureControllerServiceRunningAsync()
    {
        var state = await QueryControllerServiceStateAsync();
        if (state == ControllerServiceState.Running)
        {
            return true;
        }

        if (state == ControllerServiceState.Missing)
        {
            MessageBox.Show(
                this,
                "The Pico DMX Controller service is not installed. Repair or reinstall the application.",
                "Pico DMX Controller",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return false;
        }

        var answer = MessageBox.Show(
            this,
            "The Pico DMX server is stopped.\r\n\r\n" +
            "Starting the controller server requires Windows administrator approval.",
            "Pico DMX Controller",
            MessageBoxButtons.OKCancel,
            MessageBoxIcon.Information);
        if (answer != DialogResult.OK)
        {
            return false;
        }

        statusLabel.Text = "Starting the Pico DMX server…";
        try
        {
            using var startProcess = Process.Start(new ProcessStartInfo
            {
                FileName = "sc.exe",
                Arguments = "start PicoDmxController",
                UseShellExecute = true,
                Verb = "runas",
                WindowStyle = ProcessWindowStyle.Hidden
            });
            if (startProcess is null)
            {
                return false;
            }
            await startProcess.WaitForExitAsync();
        }
        catch
        {
            return false;
        }

        var deadline = DateTime.UtcNow + TimeSpan.FromSeconds(12);
        while (DateTime.UtcNow < deadline)
        {
            if (await QueryControllerServiceStateAsync() == ControllerServiceState.Running)
            {
                return true;
            }
            await Task.Delay(250);
        }

        MessageBox.Show(
            this,
            "The Pico DMX server could not be started, or administrator approval was cancelled.",
            "Pico DMX Controller",
            MessageBoxButtons.OK,
            MessageBoxIcon.Warning);
        return false;
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
        Close();
    }

    private async void HandleFormClosing(object? sender, FormClosingEventArgs eventArgs)
    {
        if (exiting)
        {
            CompleteExit();
            return;
        }

        eventArgs.Cancel = true;
        if (closeInProgress)
        {
            return;
        }

        var answer = MessageBox.Show(
            this,
            "Stopping the server disconnects iPads and other operator devices.\r\n\r\n" +
            "Stop Pico DMX Controller and exit?",
            "Pico DMX Controller",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Question,
            MessageBoxDefaultButton.Button2);
        if (answer != DialogResult.Yes)
        {
            return;
        }

        closeInProgress = true;
        Enabled = false;
        statusLabel.Text = "Stopping the Pico DMX server…";
        var stopped = await StopControllerServiceAsync();
        if (!stopped)
        {
            closeInProgress = false;
            Enabled = true;
            statusLabel.Text = "The server is still running.";
            MessageBox.Show(
                this,
                "The Pico DMX server could not be stopped, or administrator approval was cancelled.\r\n\r\n" +
                "The application will remain open.",
                "Pico DMX Controller",
                MessageBoxButtons.OK,
                MessageBoxIcon.Warning);
            return;
        }

        exiting = true;
        Close();
    }

    private static async Task<bool> StopControllerServiceAsync()
    {
        var initialState = await QueryControllerServiceStateAsync();
        if (initialState is ControllerServiceState.Stopped or ControllerServiceState.Missing)
        {
            return true;
        }

        try
        {
            using var stopProcess = Process.Start(new ProcessStartInfo
            {
                FileName = "sc.exe",
                Arguments = "stop PicoDmxController",
                UseShellExecute = true,
                Verb = "runas",
                WindowStyle = ProcessWindowStyle.Hidden
            });
            if (stopProcess is null)
            {
                return false;
            }
            await stopProcess.WaitForExitAsync();
        }
        catch
        {
            return false;
        }

        var deadline = DateTime.UtcNow + TimeSpan.FromSeconds(12);
        while (DateTime.UtcNow < deadline)
        {
            var state = await QueryControllerServiceStateAsync();
            if (state is ControllerServiceState.Stopped or ControllerServiceState.Missing)
            {
                return true;
            }
            await Task.Delay(250);
        }
        return false;
    }

    private static async Task<ControllerServiceState> QueryControllerServiceStateAsync()
    {
        try
        {
            using var queryProcess = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = "sc.exe",
                    Arguments = "query PicoDmxController",
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                }
            };
            queryProcess.Start();
            var output = await queryProcess.StandardOutput.ReadToEndAsync();
            await queryProcess.WaitForExitAsync();
            if (queryProcess.ExitCode != 0)
            {
                return ControllerServiceState.Missing;
            }

            var matches = System.Text.RegularExpressions.Regex.Matches(
                output,
                @"(?m)^\s*[\p{L}_]+\s*:\s*(\d+)\s");
            foreach (System.Text.RegularExpressions.Match match in matches)
            {
                if (!int.TryParse(match.Groups[1].Value, out var value) || value is < 1 or > 7)
                {
                    continue;
                }

                return value switch
                {
                    1 => ControllerServiceState.Stopped,
                    4 => ControllerServiceState.Running,
                    _ => ControllerServiceState.Other
                };
            }
            return ControllerServiceState.Unknown;
        }
        catch
        {
            return ControllerServiceState.Unknown;
        }
    }

    private void CompleteExit()
    {
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
