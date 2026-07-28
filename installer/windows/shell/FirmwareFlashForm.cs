using System.Diagnostics;
using System.Text;

namespace PicoDmxShell;

internal sealed class FirmwareFlashForm : Form
{
    private static readonly Color Background = Color.FromArgb(18, 22, 29);
    private static readonly Color Surface = Color.FromArgb(28, 33, 42);
    private static readonly Color Foreground = Color.FromArgb(230, 235, 242);
    private static readonly Color Muted = Color.FromArgb(164, 174, 188);
    private static readonly Color Accent = Color.FromArgb(1, 255, 230);
    private static readonly Color Warning = Color.FromArgb(245, 184, 72);

    private readonly Label status = new();
    private readonly TextBox log = new();
    private readonly ProgressBar progress = new();
    private readonly Button checkButton = new();
    private readonly Button flashButton = new();
    private readonly Button closeButton = new();
    private readonly CheckBox singlePicoConfirmation = new();
    private bool busy;
    private bool picoDetected;

    public FirmwareFlashForm(Icon? icon)
    {
        Text = "WiFiPicoDMX Firmware";
        StartPosition = FormStartPosition.CenterParent;
        MinimumSize = new Size(760, 690);
        ClientSize = new Size(820, 740);
        BackColor = Background;
        ForeColor = Foreground;
        Icon = icon;

        BuildContent();
        Shown += async (_, _) => await ValidateBundleAsync();
        FormClosing += (_, eventArgs) =>
        {
            if (!busy)
            {
                return;
            }
            eventArgs.Cancel = true;
            MessageBox.Show(
                this,
                "Firmware work is still running. Keep the Pico connected and wait for completion.",
                "WiFiPicoDMX Firmware",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
        };
    }

    private void BuildContent()
    {
        var page = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(24),
            ColumnCount = 1,
            RowCount = 9,
            AutoScroll = true
        };
        page.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        page.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        page.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        page.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        page.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        page.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        page.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        page.RowStyles.Add(new RowStyle(SizeType.Absolute, 170));
        page.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        page.RowStyles.Add(new RowStyle(SizeType.AutoSize));

        var heading = new Label
        {
            Text = "Install firmware on a Pico 2 W",
            AutoSize = true,
            Font = new Font(Font.FontFamily, 17, FontStyle.Bold),
            ForeColor = Foreground,
            Margin = new Padding(0, 0, 0, 8)
        };
        var introduction = new Label
        {
            Text = "The application and the separate Wi-Fi firmware are bundled with WiFiPicoDMX. " +
                   "Flash one Pico at a time. DMX output from that Pico stops while firmware is installed.",
            Dock = DockStyle.Fill,
            AutoSize = true,
            MaximumSize = new Size(750, 0),
            ForeColor = Muted,
            Margin = new Padding(0, 0, 0, 14)
        };

        var instructions = CreateSurfacePanel();
        var instructionText = new Label
        {
            AutoSize = true,
            MaximumSize = new Size(720, 0),
            ForeColor = Foreground,
            Text = "Put the target Pico into BOOTSEL mode\r\n\r\n" +
                   "1. Disconnect every other Pico from this computer.\r\n" +
                   "2. Unplug the target Pico's USB cable.\r\n" +
                   "3. Press and hold the BOOTSEL button on the Pico.\r\n" +
                   "4. While holding BOOTSEL, reconnect the USB cable to this computer.\r\n" +
                   "5. Release BOOTSEL when Windows detects the Pico (usually as RPI-RP2).\r\n\r\n" +
                   "Do not disconnect power or USB after flashing starts."
        };
        instructions.Controls.Add(instructionText);

        singlePicoConfirmation.Text =
            "I have disconnected all other Picos and the target Pico is in BOOTSEL mode.";
        singlePicoConfirmation.AutoSize = true;
        singlePicoConfirmation.ForeColor = Foreground;
        singlePicoConfirmation.Margin = new Padding(0, 14, 0, 8);
        singlePicoConfirmation.CheckedChanged += (_, _) =>
        {
            checkButton.Enabled = !busy && singlePicoConfirmation.Checked;
            if (!singlePicoConfirmation.Checked)
            {
                picoDetected = false;
            }
            UpdateFlashButton();
        };

        var actions = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            AutoSize = true,
            WrapContents = true,
            Margin = new Padding(0, 0, 0, 10)
        };
        ConfigureButton(checkButton, "Check for Pico", Surface);
        ConfigureButton(flashButton, "Flash application + Wi-Fi firmware", Color.FromArgb(0, 104, 96));
        ConfigureButton(closeButton, "Close", Surface);
        checkButton.Enabled = false;
        flashButton.Enabled = false;
        checkButton.Click += async (_, _) => await CheckForPicoAsync();
        flashButton.Click += async (_, _) => await FlashAsync();
        closeButton.Click += (_, _) => Close();
        actions.Controls.Add(checkButton);
        actions.Controls.Add(flashButton);
        actions.Controls.Add(closeButton);

        status.Text = "Checking the bundled firmware…";
        status.AutoSize = true;
        status.ForeColor = Warning;
        status.Margin = new Padding(0, 0, 0, 8);

        progress.Dock = DockStyle.Top;
        progress.Height = 8;
        progress.Style = ProgressBarStyle.Marquee;
        progress.MarqueeAnimationSpeed = 25;
        progress.Margin = new Padding(0, 0, 0, 10);

        log.Dock = DockStyle.Fill;
        log.Multiline = true;
        log.ReadOnly = true;
        log.ScrollBars = ScrollBars.Vertical;
        log.BackColor = Color.FromArgb(10, 13, 16);
        log.ForeColor = Muted;
        log.BorderStyle = BorderStyle.FixedSingle;
        log.Font = new Font(FontFamily.GenericMonospace, 9);

        var recovery = new Label
        {
            AutoSize = true,
            MaximumSize = new Size(750, 0),
            ForeColor = Muted,
            Text = "Recovery: BOOTSEL is stored in read-only ROM. If flashing is interrupted, repeat the " +
                   "BOOTSEL steps and run the firmware installer again."
        };

        page.Controls.Add(heading);
        page.Controls.Add(introduction);
        page.Controls.Add(instructions);
        page.Controls.Add(singlePicoConfirmation);
        page.Controls.Add(actions);
        page.Controls.Add(status);
        page.Controls.Add(log);
        page.Controls.Add(progress);
        page.Controls.Add(recovery);
        Controls.Add(page);
    }

    private static Panel CreateSurfacePanel()
    {
        var panel = new Panel
        {
            AutoSize = true,
            Dock = DockStyle.Fill,
            Padding = new Padding(16),
            BackColor = Surface,
            Margin = new Padding(0)
        };
        return panel;
    }

    private static void ConfigureButton(Button button, string text, Color background)
    {
        button.Text = text;
        button.AutoSize = true;
        button.Height = 34;
        button.Margin = new Padding(0, 0, 10, 0);
        button.FlatStyle = FlatStyle.Flat;
        button.BackColor = background;
        button.ForeColor = Foreground;
        button.FlatAppearance.BorderColor = Color.FromArgb(74, 88, 106);
    }

    private async Task ValidateBundleAsync()
    {
        SetBusy(true, "Validating the bundled firmware files…");
        var result = await RunFirmwareHelperAsync("-ValidateOnly");
        AppendLog(result.Output);
        SetBusy(false, result.ExitCode == 0
            ? "Firmware bundle validated. Follow the BOOTSEL steps above."
            : "The firmware bundle could not be validated. Repair or reinstall WiFiPicoDMX.");
        status.ForeColor = result.ExitCode == 0 ? Accent : Color.IndianRed;
        singlePicoConfirmation.Enabled = result.ExitCode == 0;
    }

    private async Task CheckForPicoAsync()
    {
        picoDetected = false;
        UpdateFlashButton();
        SetBusy(true, "Looking for one Pico in BOOTSEL mode…");
        var result = await RunFirmwareHelperAsync("-ProbeOnly");
        AppendLog(result.Output);
        picoDetected = result.ExitCode == 0;
        SetBusy(false, picoDetected
            ? "One Pico is ready. Confirm the target, then click Flash."
            : "No single accessible Pico was found. Repeat the BOOTSEL steps and check again.");
        status.ForeColor = picoDetected ? Accent : Warning;
        UpdateFlashButton();
    }

    private async Task FlashAsync()
    {
        var answer = MessageBox.Show(
            this,
            "Flash the application and Wi-Fi firmware now?\r\n\r\n" +
            "DMX output will stop. Keep USB connected until WiFiPicoDMX reports completion.",
            "Confirm firmware flash",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Warning,
            MessageBoxDefaultButton.Button2);
        if (answer != DialogResult.Yes)
        {
            return;
        }

        picoDetected = false;
        SetBusy(true, "Flashing firmware. Do not disconnect the Pico…");
        var result = await RunFirmwareHelperAsync("-Flash");
        AppendLog(result.Output);
        SetBusy(false, result.ExitCode == 0
            ? "Firmware installation completed. The Pico has restarted."
            : "Firmware installation did not complete. Repeat the BOOTSEL steps and try again.");
        status.ForeColor = result.ExitCode == 0 ? Accent : Color.IndianRed;
        if (result.ExitCode == 0)
        {
            MessageBox.Show(
                this,
                "Application and Wi-Fi firmware were installed successfully.\r\n\r\n" +
                "You can disconnect the Pico or close this window.",
                "Firmware complete",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
        }
        UpdateFlashButton();
    }

    private void SetBusy(bool value, string message)
    {
        busy = value;
        status.Text = message;
        progress.Visible = value;
        checkButton.Enabled = !value && singlePicoConfirmation.Checked;
        closeButton.Enabled = !value;
        singlePicoConfirmation.Enabled = !value;
        UpdateFlashButton();
    }

    private void UpdateFlashButton()
    {
        flashButton.Enabled = !busy && singlePicoConfirmation.Checked && picoDetected;
    }

    private void AppendLog(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return;
        }
        log.AppendText(value.TrimEnd() + Environment.NewLine);
        log.SelectionStart = log.TextLength;
        log.ScrollToCaret();
    }

    private static async Task<FirmwareHelperResult> RunFirmwareHelperAsync(string operation)
    {
        var script = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "..",
            "support",
            "flash_firmware.ps1"));
        if (!File.Exists(script))
        {
            return new FirmwareHelperResult(-1, $"Firmware helper is missing: {script}");
        }

        var powershell = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.Windows),
            "System32",
            "WindowsPowerShell",
            "v1.0",
            "powershell.exe");
        var startInfo = new ProcessStartInfo
        {
            FileName = powershell,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };
        startInfo.ArgumentList.Add("-NoProfile");
        startInfo.ArgumentList.Add("-NonInteractive");
        startInfo.ArgumentList.Add("-ExecutionPolicy");
        startInfo.ArgumentList.Add("Bypass");
        startInfo.ArgumentList.Add("-File");
        startInfo.ArgumentList.Add(script);
        startInfo.ArgumentList.Add(operation);

        using var process = new Process { StartInfo = startInfo };
        var output = new StringBuilder();
        process.Start();
        var stdout = process.StandardOutput.ReadToEndAsync();
        var stderr = process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        output.Append(await stdout);
        var error = await stderr;
        if (!string.IsNullOrWhiteSpace(error))
        {
            output.AppendLine(error);
        }
        return new FirmwareHelperResult(process.ExitCode, output.ToString());
    }

    private sealed record FirmwareHelperResult(int ExitCode, string Output);
}
