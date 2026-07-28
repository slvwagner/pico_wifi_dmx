using System.Runtime.InteropServices;

namespace PicoDmxShell;

internal static class WindowsTheme
{
    private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
    private const int DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1 = 19;

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(
        IntPtr windowHandle,
        int attribute,
        ref int attributeValue,
        int attributeSize);

    public static void ApplyDarkTitleBar(Form form)
    {
        form.HandleCreated += (_, _) => ApplyDarkTitleBarToHandle(form.Handle);
        if (form.IsHandleCreated)
        {
            ApplyDarkTitleBarToHandle(form.Handle);
        }
    }

    private static void ApplyDarkTitleBarToHandle(IntPtr handle)
    {
        if (!OperatingSystem.IsWindows())
        {
            return;
        }

        var enabled = 1;
        try
        {
            var result = DwmSetWindowAttribute(
                handle,
                DWMWA_USE_IMMERSIVE_DARK_MODE,
                ref enabled,
                sizeof(int));
            if (result != 0)
            {
                DwmSetWindowAttribute(
                    handle,
                    DWMWA_USE_IMMERSIVE_DARK_MODE_BEFORE_20H1,
                    ref enabled,
                    sizeof(int));
            }
        }
        catch (DllNotFoundException)
        {
            // Very old Windows versions retain their system-default title bar.
        }
    }
}
