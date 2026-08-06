using System.Text.Json;

namespace PicoDmxShell;

internal static class FirmwareCompatibilityChecker
{
    public static async Task<FirmwareCompatibilityResult> CheckAsync(
        Uri controllerUri,
        string bundledFirmwareVersion,
        CancellationToken cancellationToken = default)
    {
        using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(12) };
        var discoveryUri = new Uri(controllerUri, "pico_discovery.php?timeoutMs=3200");
        using var response = await client.GetAsync(discoveryUri, cancellationToken);
        var payload = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"Discovery returned HTTP {(int)response.StatusCode}.");
        }

        var discovery = JsonSerializer.Deserialize<DiscoveryResponse>(
            payload,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        if (discovery is null || !discovery.Ok)
        {
            throw new InvalidOperationException(discovery?.Error ?? "Discovery returned an invalid response.");
        }

        var devices = discovery.Devices.Select(device => new FirmwareDeviceCompatibility(
            string.IsNullOrWhiteSpace(device.Name) ? "Pico" : device.Name.Trim(),
            string.IsNullOrWhiteSpace(device.Ip) ? device.Url : device.Ip,
            device.Version,
            device.Version == bundledFirmwareVersion)).ToList();
        return new FirmwareCompatibilityResult(bundledFirmwareVersion, devices);
    }

    public static string ReadBundledFirmwareVersion()
    {
        var manifestPath = Path.GetFullPath(Path.Combine(
            AppContext.BaseDirectory,
            "..",
            "firmware",
            "firmware-manifest.json"));
        using var document = JsonDocument.Parse(File.ReadAllText(manifestPath));
        var version = document.RootElement.GetProperty("version").GetString()?.Trim();
        if (string.IsNullOrWhiteSpace(version))
        {
            throw new InvalidOperationException("firmware-manifest.json does not contain a version.");
        }
        return version;
    }

    private sealed class DiscoveryResponse
    {
        public bool Ok { get; set; }
        public string? Error { get; set; }
        public List<DiscoveredPico> Devices { get; set; } = [];
    }

    private sealed class DiscoveredPico
    {
        public string Name { get; set; } = "";
        public string Version { get; set; } = "";
        public string Ip { get; set; } = "";
        public string Url { get; set; } = "";
    }
}

internal sealed record FirmwareCompatibilityResult(
    string BundledVersion,
    IReadOnlyList<FirmwareDeviceCompatibility> Devices)
{
    public int TotalCount => Devices.Count;
    public int CurrentCount => Devices.Count(device => device.IsCurrent);
    public int UpdateCount => TotalCount - CurrentCount;
}

internal sealed record FirmwareDeviceCompatibility(
    string Name,
    string Address,
    string InstalledVersion,
    bool IsCurrent);
