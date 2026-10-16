const { withDangerousMod, withFinalizedMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");
const { VECTOR_XML } = require("./withAndroidMonochromeVector");

// Experimental: on Android 12+ the launcher icon is a white tile with the
// clover painted in the wallpaper's Material You primary colour
// (system_accent1_600, the light scheme's primary, same as the app's).
// Like the original artwork's green glow, each petal blends toward the
// centre into the wallpaper's tertiary colour (system_accent3_200).
// Older Android keeps the normal icon (mipmap-anydpi-v26). The monochrome
// layer stays for themed icons.
//
// The splash screen uses the same clover on the wallpaper's neutral surface,
// with a dark variant (values-night-v31) using the dark scheme's primary and
// tertiary. The splash has its own colour names so night mode never changes
// the launcher icon.
//
// The SNDYY logo sits in the splash's branding slot at the bottom, in the
// same primary colour as the clover tips.

const CENTER = 514; // clover centre in the 1028x1028 viewport
const PETAL_REACH = 270; // centre to petal tips

const pathData = [...VECTOR_XML.matchAll(/android:pathData="([^"]+)"/g)].map((m) => m[1]);

// Each petal is one radial gradient: the wallpaper's tertiary colour at the
// centre, blending into the primary colour toward the tips, like the original
// artwork's green-to-purple glow. Both ends are opaque colour references, so
// no transparency is involved.
const petal = (center, tips) => (d) => `    <path android:pathData="${d}">
        <aapt:attr name="android:fillColor">
            <gradient android:type="radial"
                android:centerX="${CENTER}" android:centerY="${CENTER}"
                android:gradientRadius="${PETAL_REACH}">
                <item android:offset="0" android:color="@color/${center}"/>
                <item android:offset="1" android:color="@color/${tips}"/>
            </gradient>
        </aapt:attr>
    </path>`;

const clover = (center, tips) => `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:aapt="http://schemas.android.com/aapt"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="1028"
    android:viewportHeight="1028">
${pathData.map(petal(center, tips)).join("\n")}
</vector>
`;

// Android's branding slot is 200x80dp. The logo fills 60% of its width,
// centred, so it reads as a small signature under the clover.
const LOGO = fs.readFileSync(path.join(__dirname, "../assets/images/sndyy-logo.svg"), "utf8");
const LOGO_PATH = LOGO.match(/ d="([^"]+)"/)[1];
const [LOGO_X, LOGO_Y, LOGO_W, LOGO_H] = LOGO.match(/viewBox="([^"]+)"/)[1].split(" ").map(Number);
const BRAND_W = Math.round(LOGO_W / 0.6);
const BRAND_H = Math.round(BRAND_W / 2.5);
const BRANDING = `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="200dp"
    android:height="80dp"
    android:viewportWidth="${BRAND_W}"
    android:viewportHeight="${BRAND_H}">
    <group
        android:translateX="${Math.round((BRAND_W - LOGO_W) / 2 - LOGO_X)}"
        android:translateY="${Math.round((BRAND_H - LOGO_H) / 2 - LOGO_Y)}">
        <path android:fillColor="@color/splash_branding" android:pathData="${LOGO_PATH}"/>
    </group>
</vector>
`;

const colors = (entries) => `<?xml version="1.0" encoding="utf-8"?>
<resources>
${Object.entries(entries)
  .map(([name, value]) => `    <color name="${name}">@android:color/${value}</color>`)
  .join("\n")}
</resources>
`;

// splashscreen_background / activityBackground override the ones
// expo-splash-screen writes in values/colors.xml.
const LIGHT = colors({
  ic_launcher_dynamic_bg: "white",
  ic_launcher_dynamic_fg: "system_accent1_600",
  ic_launcher_dynamic_center: "system_accent3_200",
  splashscreen_background: "system_neutral1_10",
  activityBackground: "system_neutral1_10",
  splash_clover_tips: "system_accent1_600",
  splash_clover_center: "system_accent3_200",
  splash_branding: "system_accent1_600",
});
const DARK = colors({
  splashscreen_background: "system_neutral1_900",
  activityBackground: "system_neutral1_900",
  splash_clover_tips: "system_accent1_200",
  splash_clover_center: "system_accent3_200",
  splash_branding: "system_accent1_200",
});

const ADAPTIVE_ICON = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_dynamic_bg"/>
    <foreground android:drawable="@drawable/ic_launcher_dynamic_fg"/>
    <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>
</adaptive-icon>
`;

const write = (file, contents) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
};

// The branding attribute only exists on Android 12+; older versions ignore it
// (expo-splash-screen does the same with windowSplashScreenBehavior). It runs
// as a finalized mod because expo-splash-screen rewrites the splash style
// after other plugins' style mods.
const BRANDING_ITEM =
  '<item name="android:windowSplashScreenBrandingImage">@drawable/splashscreen_branding</item>';
const withSplashBranding = (config) =>
  withFinalizedMod(config, [
    "android",
    async (config) => {
      const file = path.join(config.modRequest.platformProjectRoot, "app/src/main/res/values/styles.xml");
      const xml = fs.readFileSync(file, "utf8");
      if (!xml.includes(BRANDING_ITEM)) {
        fs.writeFileSync(
          file,
          xml.replace(
            /(<style name="Theme\.App\.SplashScreen"[^>]*>[\s\S]*?)(\s*<\/style>)/,
            `$1\n    ${BRANDING_ITEM}$2`,
          ),
        );
      }
      return config;
    },
  ]);

const withDynamicColorIcon = (config) =>
  withDangerousMod(withSplashBranding(config), [
    "android",
    async (config) => {
      const res = path.join(config.modRequest.platformProjectRoot, "app/src/main/res");
      write(
        path.join(res, "drawable-v31/ic_launcher_dynamic_fg.xml"),
        clover("ic_launcher_dynamic_center", "ic_launcher_dynamic_fg"),
      );
      // anydpi so it wins over expo-splash-screen's per-density PNGs.
      write(
        path.join(res, "drawable-anydpi-v31/splashscreen_logo.xml"),
        clover("splash_clover_center", "splash_clover_tips"),
      );
      write(path.join(res, "drawable/splashscreen_branding.xml"), BRANDING);
      // Fallback colour so the drawable resolves below Android 12 too.
      write(
        path.join(res, "values/splash_branding.xml"),
        `<resources>\n    <color name="splash_branding">#023c69</color>\n</resources>\n`,
      );
      write(path.join(res, "values-v31/ic_launcher_dynamic.xml"), LIGHT);
      write(path.join(res, "values-night-v31/ic_launcher_dynamic.xml"), DARK);
      for (const name of ["ic_launcher", "ic_launcher_round"]) {
        write(path.join(res, `mipmap-anydpi-v31/${name}.xml`), ADAPTIVE_ICON);
      }
      return config;
    },
  ]);

module.exports = withDynamicColorIcon;
