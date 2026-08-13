const path = require("path");
const { execSync } = require("child_process");
const fs = require("fs");

module.exports = async function (configuration) {
  const certificatePath = process.env.WIN_CERTIFICATE_PATH;
  const certificatePassword = process.env.WIN_CERTIFICATE_PASSWORD;

  if (!certificatePath || !certificatePassword) {
    console.warn("Code signing skipped: Certificate not configured");
    return;
  }

  const filesToSign = configuration.files;

  for (const file of filesToSign) {
    if (file.endsWith(".exe") || file.endsWith(".msi")) {
      try {
        console.log(`Signing ${path.basename(file)}...`);

        execSync(
          `signtool sign /f "${certificatePath}" /p "${certificatePassword}" /t http://timestamp.digicert.com /fd sha256 /v "${file}"`,
          { stdio: "inherit" },
        );
      } catch (error) {
        console.error(`Failed to sign ${file}:`, error);
        throw error;
      }
    }
  }
};
