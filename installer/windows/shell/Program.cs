using System.Threading;

namespace PicoDmxShell;

internal static class Program
{
    private const string MutexName = @"Local\PicoDmxControllerShell";
    private const string ActivateEventName = @"Local\PicoDmxControllerShell.Activate";

    [STAThread]
    private static void Main(string[] args)
    {
        using var mutex = new Mutex(true, MutexName, out var ownsMutex);
        using var activateEvent = new EventWaitHandle(
            false,
            EventResetMode.AutoReset,
            ActivateEventName);

        if (!ownsMutex)
        {
            activateEvent.Set();
            return;
        }

        var url = ReadArgument(args, "--url") ?? "http://localhost:8090/";
        ApplicationConfiguration.Initialize();
        Application.Run(new MainForm(url, activateEvent));
    }

    private static string? ReadArgument(string[] args, string name)
    {
        for (var index = 0; index < args.Length - 1; index++)
        {
            if (string.Equals(args[index], name, StringComparison.OrdinalIgnoreCase))
            {
                return args[index + 1];
            }
        }
        return null;
    }
}
