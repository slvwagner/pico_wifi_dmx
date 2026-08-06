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
    private readonly Button firmwareCheckButton = new();
    private readonly Button checkButton = new();
    private readonly Button flashButton = new();
    private readonly Button closeButton = new();
    private readonly CheckBox singlePicoConfirmation = new();
    private readonly CheckBox provisionWifi = new() { Checked = true };
    private readonly TextBox wifiSsid = new();
    private readonly TextBox wifiPassword = new();
    private readonly Uri controllerUri;
    private readonly bool checkInstalledFirmwareOnStart;
    private bool busy;
    private bool bundleValidated;
    private bool picoDetected;
    private string bundledFirmwareVersion = "";

    public FirmwareFlashForm(
        Icon? icon,
        Uri controllerUri,
        bool checkInstalledFirmwareOnStart = false)
    {
        this.controllerUri = controllerUri;
        this.checkInstalledFirmwareOnStart = checkInstalledFirmwareOnStart;
        Text = "WiFiPicoDMX Firmware";
        StartPosition = FormStartPosition.CenterParent;
        MinimumSize = new Size(760, 760);
        ClientSize = new Size(820, 840);
        BackColor = Background;
        ForeColor = Foreground;
        Icon = icon;
        WindowsTheme.ApplyDarkTitleBar(this);

        BuildContent();
        Shown += async (_, _) =>
        {
            await ValidateBundleAsync();
            if (bundleValidated && this.checkInstalledFirmwareOnStart)
            {
                await CheckInstalledFirmwareAsync();
            }
        };
        FormClosing += (_, eventArgs) =>
        {
            if (!busy)
            {
                return;
            }
            eventArgs.Cancel = true;
            DarkMessageBox.Show(
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
            RowCount = 11,
            AutoScroll = true
        };
        page.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        page.RowStyles.Add(new RowStyle(SizeType.AutoSize));
        page.RowStyles.Add(new RowStyle(SizeType.AutoSize));
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

        var installedFirmware = CreateSurfacePanel();
        var installedFirmwareContent = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            AutoSize = true,
            FlowDirection = FlowDirection.TopDown,
            WrapContents = false,
            Margin = new Padding(0)
        };
        var installedFirmwareText = new Label
        {
            AutoSize = true,
            MaximumSize = new Size(700, 0),
            ForeColor = Foreground,
            Text = "Check Picos on the network before using BOOTSEL. WiFiPicoDMX reuses the Controller's " +
                   "Pico discovery service and compares every reported version with the bundled firmware."
        };
        ConfigureButton(firmwareCheckButton, "Check installed firmware", Surface);
        firmwareCheckButton.Enabled = false;
        firmwareCheckButton.Margin = new Padding(0, 10, 0, 0);
        firmwareCheckButton.Click += async (_, _) => await CheckInstalledFirmwareAsync();
        installedFirmwareContent.Controls.Add(installedFirmwareText);
        installedFirmwareContent.Controls.Add(firmwareCheckButton);
        installedFirmware.Controls.Add(installedFirmwareContent);

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

        var wifiConfiguration = CreateSurfacePanel();
        var wifiLayout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            AutoSize = true,
            ColumnCount = 2,
            RowCount = 4,
            Margin = new Padding(0)
        };
        wifiLayout.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
        wifiLayout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        provisionWifi.Text = "Set or change this Pico's Wi-Fi credentials";
        provisionWifi.AutoSize = true;
        provisionWifi.ForeColor = Foreground;
        provisionWifi.Margin = new Padding(0, 0, 0, 8);
        provisionWifi.CheckedChanged += (_, _) => UpdateWifiFields();
        wifiLayout.Controls.Add(provisionWifi, 0, 0);
        wifiLayout.SetColumnSpan(provisionWifi, 2);
        var wifiExplanation = new Label
        {
            Text = "Required once when upgrading from firmware that embedded credentials. " +
                   "Later firmware-only updates preserve this separate configuration.",
            AutoSize = true,
            MaximumSize = new Size(700, 0),
            ForeColor = Muted,
            Margin = new Padding(0, 0, 0, 10)
        };
        wifiLayout.Controls.Add(wifiExplanation, 0, 1);
        wifiLayout.SetColumnSpan(wifiExplanation, 2);
        var ssidLabel = new Label
        {
            Text = "Wi-Fi network name (SSID)",
            AutoSize = true,
            ForeColor = Foreground,
            Margin = new Padding(0, 7, 14, 5)
        };
        wifiSsid.Dock = DockStyle.Top;
        wifiSsid.MaxLength = 32;
        wifiSsid.BackColor = Color.FromArgb(10, 13, 16);
        wifiSsid.ForeColor = Foreground;
        wifiLayout.Controls.Add(ssidLabel, 0, 2);
        wifiLayout.Controls.Add(wifiSsid, 1, 2);
        var passwordLabel = new Label
        {
            Text = "Wi-Fi password",
            AutoSize = true,
            ForeColor = Foreground,
            Margin = new Padding(0, 7, 14, 0)
        };
        wifiPassword.Dock = DockStyle.Top;
        wifiPassword.MaxLength = 64;
        wifiPassword.UseSystemPasswordChar = true;
        wifiPassword.BackColor = Color.FromArgb(10, 13, 16);
        wifiPassword.ForeColor = Foreground;
        wifiLayout.Controls.Add(passwordLabel, 0, 3);
        wifiLayout.Controls.Add(wifiPassword, 1, 3);
        wifiConfiguration.Controls.Add(wifiLayout);

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
        page.Controls.Add(installedFirmware);
        page.Controls.Add(instructions);
        page.Controls.Add(wifiConfiguration);
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
        bundleValidated = result.ExitCode == 0;
        if (bundleValidated)
        {
            try
            {
                bundledFirmwareVersion = FirmwareCompatibilityChecker.ReadBundledFirmwareVersion();
            }
            catch (Exception exception)
            {
                bundleValidated = false;
                AppendLog($"Could not read the bundled firmware version: {exception.Message}");
            }
        }
        SetBusy(false, bundleValidated
            ? $"Firmware bundle {bundledFirmwareVersion} validated. Check installed firmware or follow the BOOTSEL steps."
            : "The firmware bundle could not be validated. Repair or reinstall WiFiPicoDMX.");
        status.ForeColor = bundleValidated ? Accent : Color.IndianRed;
    }

    private async Task CheckInstalledFirmwareAsync()
    {
        SetBusy(true, "Finding network Picos and checking their firmware…");
        AppendLog($"Checking for firmware {bundledFirmwareVersion} with the Controller's Pico discovery service...");
        try
        {
            var compatibility = await FirmwareCompatibilityChecker.CheckAsync(
                controllerUri,
                bundledFirmwareVersion);
            if (compatibility.TotalCount == 0)
            {
                SetBusy(false, "No running Pico was found. Check power and Wi-Fi, then try again.");
                status.ForeColor = Warning;
                AppendLog("No Pico discovery beacon was received.");
                return;
            }

            foreach (var device in compatibility.Devices)
            {
                string result;
                if (device.IsCurrent)
                {
                    result = "Firmware current";
                }
                else if (string.IsNullOrWhiteSpace(device.InstalledVersion))
                {
                    result = "Version not reported";
                }
                else
                {
                    result = "Update needed";
                }
                var installed = string.IsNullOrWhiteSpace(device.InstalledVersion)
                    ? "not reported"
                    : device.InstalledVersion;
                AppendLog($"{device.Name} · {device.Address} · installed {installed} · " +
                          $"bundled {bundledFirmwareVersion} · {result}");
            }

            var total = compatibility.TotalCount;
            var updateCount = compatibility.UpdateCount;
            SetBusy(false, updateCount == 0
                ? $"Firmware current on all {total} discovered Pico{(total == 1 ? "" : "s")} ({bundledFirmwareVersion})."
                : $"{updateCount} of {total} discovered Pico{(total == 1 ? "" : "s")} need attention. See the details below.");
            status.ForeColor = updateCount == 0 ? Accent : Warning;
        }
        catch (Exception exception)
        {
            AppendLog($"Firmware check failed: {exception.Message}");
            SetBusy(false, "Could not check installed firmware. Ensure the local server is running and try again.");
            status.ForeColor = Color.IndianRed;
        }
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
        string? ssid = null;
        string? password = null;
        if (provisionWifi.Checked && !TryGetWifiCredentials(out ssid, out password, out var validationError))
        {
            status.Text = validationError;
            status.ForeColor = Color.IndianRed;
            return;
        }
        var answer = DarkMessageBox.Show(
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
        var result = await RunFirmwareHelperAsync("-Flash", ssid, password);
        password = null;
        AppendLog(result.Output);
        SetBusy(false, result.ExitCode == 0
            ? "Firmware installation completed. The Pico has restarted."
            : "Firmware installation did not complete. Repeat the BOOTSEL steps and try again.");
        status.ForeColor = result.ExitCode == 0 ? Accent : Color.IndianRed;
        if (result.ExitCode == 0)
        {
            wifiPassword.Clear();
            DarkMessageBox.Show(
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
        firmwareCheckButton.Enabled = !value && bundleValidated;
        checkButton.Enabled = !value && singlePicoConfirmation.Checked;
        closeButton.Enabled = !value;
        singlePicoConfirmation.Enabled = !value && bundleValidated;
        provisionWifi.Enabled = !value;
        UpdateWifiFields();
        UpdateFlashButton();
    }

    private void UpdateWifiFields()
    {
        wifiSsid.Enabled = !busy && provisionWifi.Checked;
        wifiPassword.Enabled = !busy && provisionWifi.Checked;
    }

    private bool TryGetWifiCredentials(
        out string? ssid,
        out string? password,
        out string validationError)
    {
        ssid = wifiSsid.Text;
        password = wifiPassword.Text;
        var ssidBytes = Encoding.UTF8.GetByteCount(ssid);
        var passwordBytes = Encoding.UTF8.GetByteCount(password);
        if (ssidBytes is < 1 or > 32)
        {
            validationError = "The Wi-Fi network name must contain 1 to 32 UTF-8 bytes.";
            return false;
        }
        if (passwordBytes is < 8 or > 64)
        {
            validationError = "The Wi-Fi password must contain 8 to 64 UTF-8 bytes.";
            return false;
        }
        if (passwordBytes == 64 && !password.All(Uri.IsHexDigit))
        {
            validationError = "A 64-byte Wi-Fi password must be hexadecimal.";
            return false;
        }
        validationError = "";
        return true;
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

    private static async Task<FirmwareHelperResult> RunFirmwareHelperAsync(
        string operation,
        string? ssid = null,
        string? password = null)
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
        startInfo.Environment.Remove("PICO_DMX_WIFI_PROVISION");
        startInfo.Environment.Remove("PICO_DMX_WIFI_SSID");
        startInfo.Environment.Remove("PICO_DMX_WIFI_PASSWORD");
        if (ssid is not null && password is not null)
        {
            startInfo.Environment["PICO_DMX_WIFI_PROVISION"] = "1";
            startInfo.Environment["PICO_DMX_WIFI_SSID"] = ssid;
            startInfo.Environment["PICO_DMX_WIFI_PASSWORD"] = password;
        }

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
