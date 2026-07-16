const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

// Android's themed-icon (Material You) rendering only reliably tints a
// VectorDrawable <monochrome> layer. Expo's app.json `monochromeImage` only
// rasterizes a PNG into mipmap-*/ic_launcher_monochrome.webp, which most
// launchers (Pixel Launcher included) silently ignore for theming. This
// plugin swaps the generated raster monochrome layer for a hand-converted
// vector after prebuild.

const VECTOR_XML = `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="1028"
    android:viewportHeight="1028">
    <path android:fillColor="#FF000000" android:pathData="M514.001 514C480.477 413.428 346.382 430.19 346.382 312.857C346.382 229.048 446.953 229.048 514.001 312.857C581.048 229.048 681.62 229.048 681.62 312.857C681.62 430.19 547.525 413.428 514.001 514Z"/>
    <path android:fillColor="#FF000000" android:pathData="M514 513.999C614.572 480.475 597.81 346.38 715.143 346.38C798.952 346.38 798.952 446.951 715.143 513.999C798.952 581.046 798.952 681.618 715.143 681.618C597.81 681.618 614.572 547.523 514 513.999Z"/>
    <path android:fillColor="#FF000000" android:pathData="M513.999 514C547.523 614.572 681.618 597.81 681.618 715.143C681.618 798.952 581.047 798.952 513.999 715.143C446.952 798.952 346.38 798.952 346.38 715.143C346.38 597.81 480.475 614.572 513.999 514Z"/>
    <path android:fillColor="#FF000000" android:pathData="M514 513.999C413.428 547.523 430.19 681.618 312.857 681.618C229.048 681.618 229.048 581.047 312.857 513.999C229.048 446.952 229.048 346.38 312.857 346.38C430.19 346.38 413.428 480.475 514 513.999Z"/>
</vector>
`;

function patchAdaptiveIconXml(filePath) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, "utf8");
  const patched = contents.replace(
    /android:drawable="@mipmap\/ic_launcher_monochrome"/g,
    'android:drawable="@drawable/ic_launcher_monochrome"'
  );
  fs.writeFileSync(filePath, patched);
}

function removeStaleRasterMonochrome(resDir) {
  if (!fs.existsSync(resDir)) return;
  for (const entry of fs.readdirSync(resDir)) {
    if (!entry.startsWith("mipmap-")) continue;
    const file = path.join(resDir, entry, "ic_launcher_monochrome.webp");
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

const withAndroidMonochromeVector = (config) => {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.platformProjectRoot;
      const resDir = path.join(projectRoot, "app/src/main/res");
      const drawableDir = path.join(resDir, "drawable");

      fs.mkdirSync(drawableDir, { recursive: true });
      fs.writeFileSync(
        path.join(drawableDir, "ic_launcher_monochrome.xml"),
        VECTOR_XML
      );

      patchAdaptiveIconXml(
        path.join(resDir, "mipmap-anydpi-v26/ic_launcher.xml")
      );
      patchAdaptiveIconXml(
        path.join(resDir, "mipmap-anydpi-v26/ic_launcher_round.xml")
      );

      removeStaleRasterMonochrome(resDir);

      return config;
    },
  ]);
};

module.exports = withAndroidMonochromeVector;
