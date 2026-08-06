function New-WifiConfigurationUf2([string]$Path, [string]$Ssid, [string]$Password) {
    if (-not ('PicoDmxWifiUf2' -as [type])) {
        Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;

public static class PicoDmxWifiUf2
{
    private static void WriteUInt32(byte[] target, int offset, uint value)
    {
        target[offset] = (byte)value;
        target[offset + 1] = (byte)(value >> 8);
        target[offset + 2] = (byte)(value >> 16);
        target[offset + 3] = (byte)(value >> 24);
    }

    private static uint Crc32(byte[] data, int length)
    {
        uint crc = 0xffffffffu;
        for (int index = 0; index < length; index++) {
            crc ^= data[index];
            for (int bit = 0; bit < 8; bit++)
                crc = (crc >> 1) ^ ((crc & 1) == 0 ? 0u : 0xedb88320u);
        }
        return crc ^ 0xffffffffu;
    }

    public static void Create(string path, string ssid, string password)
    {
        var utf8 = new UTF8Encoding(false, true);
        byte[] ssidBytes = utf8.GetBytes(ssid ?? "");
        byte[] passwordBytes = utf8.GetBytes(password ?? "");
        if (ssidBytes.Length < 1 || ssidBytes.Length > 32 || Array.IndexOf(ssidBytes, (byte)0) >= 0)
            throw new ArgumentException("The Wi-Fi network name must contain 1 to 32 UTF-8 bytes.");
        if ((passwordBytes.Length < 8 || passwordBytes.Length > 64) || Array.IndexOf(passwordBytes, (byte)0) >= 0)
            throw new ArgumentException("The Wi-Fi password must contain 8 to 64 UTF-8 bytes.");
        if (passwordBytes.Length == 64) {
            foreach (byte value in passwordBytes) {
                bool hexadecimal = (value >= '0' && value <= '9') ||
                    (value >= 'a' && value <= 'f') || (value >= 'A' && value <= 'F');
                if (!hexadecimal) throw new ArgumentException("A 64-byte Wi-Fi password must be hexadecimal.");
            }
        }

        byte[] payload = new byte[256];
        Buffer.BlockCopy(Encoding.ASCII.GetBytes("PDMXWIFI"), 0, payload, 0, 8);
        WriteUInt32(payload, 8, 1);
        WriteUInt32(payload, 12, (uint)ssidBytes.Length);
        WriteUInt32(payload, 16, (uint)passwordBytes.Length);
        Buffer.BlockCopy(ssidBytes, 0, payload, 20, ssidBytes.Length);
        Buffer.BlockCopy(passwordBytes, 0, payload, 56, passwordBytes.Length);
        WriteUInt32(payload, 124, Crc32(payload, 124));

        byte[] block = new byte[512];
        WriteUInt32(block, 0, 0x0a324655u);
        WriteUInt32(block, 4, 0x9e5d5157u);
        WriteUInt32(block, 8, 0x00002000u);
        WriteUInt32(block, 12, 0x10000000u);
        WriteUInt32(block, 16, 256);
        WriteUInt32(block, 20, 0);
        WriteUInt32(block, 24, 1);
        WriteUInt32(block, 28, 0xe48bff58u);
        Buffer.BlockCopy(payload, 0, block, 32, payload.Length);
        WriteUInt32(block, 508, 0x0ab16f30u);
        File.WriteAllBytes(path, block);
        Array.Clear(passwordBytes, 0, passwordBytes.Length);
        Array.Clear(payload, 0, payload.Length);
    }
}
'@
    }
    [PicoDmxWifiUf2]::Create($Path, $Ssid, $Password)
}
