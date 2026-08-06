namespace PicoDmxShell;

internal static class DarkMessageBox
{
    private static readonly Color Background = Color.FromArgb(18, 22, 29);
    private static readonly Color Surface = Color.FromArgb(28, 33, 42);
    private static readonly Color Foreground = Color.FromArgb(230, 235, 242);
    private static readonly Color Border = Color.FromArgb(74, 88, 106);

    public static DialogResult Show(
        IWin32Window? owner,
        string text,
        string caption,
        MessageBoxButtons buttons,
        MessageBoxIcon icon = MessageBoxIcon.None,
        MessageBoxDefaultButton defaultButton = MessageBoxDefaultButton.Button1)
    {
        var messageSize = TextRenderer.MeasureText(
            text,
            SystemFonts.MessageBoxFont,
            new Size(500, 0),
            TextFormatFlags.WordBreak | TextFormatFlags.TextBoxControl);
        using var dialog = new Form
        {
            Text = caption,
            StartPosition = FormStartPosition.CenterParent,
            FormBorderStyle = FormBorderStyle.FixedDialog,
            MinimizeBox = false,
            MaximizeBox = false,
            ShowInTaskbar = false,
            AutoScaleMode = AutoScaleMode.Dpi,
            ClientSize = new Size(620, Math.Clamp(messageSize.Height + 150, 210, 480)),
            BackColor = Background,
            ForeColor = Foreground
        };
        WindowsTheme.ApplyDarkTitleBar(dialog);

        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(24),
            ColumnCount = 2,
            RowCount = 2,
            BackColor = Background
        };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Absolute, 52));
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 52));

        Image? iconImage = GetIcon(icon)?.ToBitmap();
        var iconView = new PictureBox
        {
            Width = 32,
            Height = 32,
            SizeMode = PictureBoxSizeMode.StretchImage,
            Image = iconImage,
            Margin = new Padding(0, 3, 16, 0),
            Visible = iconImage is not null
        };
        var message = new Label
        {
            Text = text,
            Dock = DockStyle.Fill,
            AutoSize = false,
            Font = SystemFonts.MessageBoxFont,
            ForeColor = Foreground,
            TextAlign = ContentAlignment.TopLeft,
            Padding = new Padding(0, 4, 0, 0)
        };
        var actions = new FlowLayoutPanel
        {
            Dock = DockStyle.Fill,
            FlowDirection = FlowDirection.RightToLeft,
            WrapContents = false,
            Padding = new Padding(0, 10, 0, 0),
            BackColor = Background
        };

        var logicalButtons = CreateButtons(buttons);
        foreach (var button in logicalButtons.AsEnumerable().Reverse())
        {
            StyleButton(button);
            actions.Controls.Add(button);
        }
        var defaultIndex = defaultButton switch
        {
            MessageBoxDefaultButton.Button2 => 1,
            MessageBoxDefaultButton.Button3 => 2,
            _ => 0
        };
        if (defaultIndex >= logicalButtons.Count)
        {
            defaultIndex = 0;
        }
        dialog.AcceptButton = logicalButtons[defaultIndex];
        dialog.CancelButton = logicalButtons.FirstOrDefault(button =>
            button.DialogResult is DialogResult.Cancel or DialogResult.No);

        layout.Controls.Add(iconView, 0, 0);
        layout.Controls.Add(message, 1, 0);
        layout.Controls.Add(actions, 0, 1);
        layout.SetColumnSpan(actions, 2);
        dialog.Controls.Add(layout);
        dialog.Shown += (_, _) => logicalButtons[defaultIndex].Focus();
        dialog.Disposed += (_, _) => iconImage?.Dispose();
        return owner is null ? dialog.ShowDialog() : dialog.ShowDialog(owner);
    }

    private static List<Button> CreateButtons(MessageBoxButtons buttons)
    {
        return buttons switch
        {
            MessageBoxButtons.OK => [CreateButton("OK", DialogResult.OK)],
            MessageBoxButtons.OKCancel =>
                [CreateButton("OK", DialogResult.OK), CreateButton("Cancel", DialogResult.Cancel)],
            MessageBoxButtons.YesNo =>
                [CreateButton("Yes", DialogResult.Yes), CreateButton("No", DialogResult.No)],
            MessageBoxButtons.YesNoCancel =>
                [CreateButton("Yes", DialogResult.Yes), CreateButton("No", DialogResult.No),
                 CreateButton("Cancel", DialogResult.Cancel)],
            MessageBoxButtons.RetryCancel =>
                [CreateButton("Retry", DialogResult.Retry), CreateButton("Cancel", DialogResult.Cancel)],
            MessageBoxButtons.AbortRetryIgnore =>
                [CreateButton("Abort", DialogResult.Abort), CreateButton("Retry", DialogResult.Retry),
                 CreateButton("Ignore", DialogResult.Ignore)],
            _ => [CreateButton("OK", DialogResult.OK)]
        };
    }

    private static Button CreateButton(string text, DialogResult result)
    {
        return new Button
        {
            Text = text,
            DialogResult = result,
            AutoSize = true,
            MinimumSize = new Size(92, 34),
            Margin = new Padding(10, 0, 0, 0)
        };
    }

    private static void StyleButton(Button button)
    {
        button.FlatStyle = FlatStyle.Flat;
        button.BackColor = Surface;
        button.ForeColor = Foreground;
        button.FlatAppearance.BorderColor = Border;
        button.FlatAppearance.MouseOverBackColor = Color.FromArgb(48, 58, 72);
    }

    private static Icon? GetIcon(MessageBoxIcon icon)
    {
        return icon switch
        {
            MessageBoxIcon.Error => SystemIcons.Error,
            MessageBoxIcon.Question => SystemIcons.Question,
            MessageBoxIcon.Warning => SystemIcons.Warning,
            MessageBoxIcon.Information => SystemIcons.Information,
            _ => null
        };
    }
}
