const GITHUB_REPO = "k3lvinlkf/openwork"

export type ReleaseAsset = {
  version: string
  fileName: string
  url: string
  type: "dmg" | "exe" | "appimage"
}

/**
 * Release assets follow a fixed naming scheme (see the stable release
 * workflow): sprintnex-mac-<arch>-<v>.dmg, sprintnex-win-<arch>-<v>.exe,
 * sprintnex-linux-<arch>-<v>.AppImage — so the download URL is
 * deterministic from (version, platform, arch); no releases-API listing needed.
 */
export function releaseAssetFor(
  version: string,
  platform: NodeJS.Platform = process.platform,
  arch: string = process.arch,
): ReleaseAsset {
  const normalized = version.trim().replace(/^v/i, "")
  if (!normalized) throw new Error("version is required")
  if (arch !== "arm64" && arch !== "x64") {
    throw new Error(`unsupported architecture: ${arch}`)
  }

  const build = (fileName: string, type: ReleaseAsset["type"]): ReleaseAsset => ({
    version: normalized,
    fileName,
    type,
    url: `https://github.com/${GITHUB_REPO}/releases/download/v${normalized}/${encodeURIComponent(fileName)}`,
  })

  if (platform === "darwin") {
    return build(`sprintnex-mac-${arch}-${normalized}.dmg`, "dmg")
  }
  if (platform === "win32") {
    return build(`sprintnex-win-${arch}-${normalized}.exe`, "exe")
  }
  if (platform === "linux") {
    return build(`sprintnex-linux-${arch}-${normalized}.AppImage`, "appimage")
  }
  throw new Error(`unsupported platform: ${platform}`)
}
