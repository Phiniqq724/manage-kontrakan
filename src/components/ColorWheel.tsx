import { hsvToHex, type Hsv } from "@/utils/color";
import { memo } from "react";
import { View, type GestureResponderEvent } from "react-native";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";

const WEDGES = 90;

/** The hue ring and white centre: drawn once per size, never while dragging. */
const WheelArt = memo(({ size }: { size: number }) => {
  const r = size / 2;
  const step = 360 / WEDGES;
  const point = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `${r + r * Math.cos(a)} ${r + r * Math.sin(a)}`;
  };
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id="white" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#ffffff" stopOpacity={1} />
          <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {Array.from({ length: WEDGES }, (_, i) => (
        <Path
          key={i}
          // A hair of overlap so no seams show between wedges.
          d={`M ${r} ${r} L ${point(i * step)} A ${r} ${r} 0 0 1 ${point((i + 1) * step + 0.6)} Z`}
          fill={hsvToHex({ h: i * step + step / 2, s: 1, v: 1 })}
        />
      ))}
      <Circle cx={r} cy={r} r={r} fill="url(#white)" />
    </Svg>
  );
});

/**
 * Round colour picker: angle is the hue, distance from the centre the
 * strength (grey in the middle). Brightness (`value.v`) darkens the wheel and
 * is set elsewhere (a slider). Drag anywhere on the wheel to pick.
 */
export const ColorWheel = ({
  size,
  value,
  onChange,
  onRelease,
}: {
  size: number;
  value: Hsv;
  onChange: (hsv: Hsv) => void;
  /** Drag finished (e.g. to sync a hex field once instead of on every move). */
  onRelease?: () => void;
}) => {
  const r = size / 2;

  const pick = (e: GestureResponderEvent) => {
    const dx = e.nativeEvent.locationX - r;
    const dy = e.nativeEvent.locationY - r;
    const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    const s = Math.min(1, Math.hypot(dx, dy) / r);
    onChange({ h, s, v: value.v });
  };

  const a = (value.h * Math.PI) / 180;
  const thumbX = r + Math.cos(a) * value.s * r;
  const thumbY = r + Math.sin(a) * value.s * r;

  return (
    <View style={{ width: size, height: size }}>
      <WheelArt size={size} />
      {/* Brightness darkens the whole wheel. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: r,
          backgroundColor: "#000000",
          opacity: 1 - value.v,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: thumbX - 14,
          top: thumbY - 14,
          width: 28,
          height: 28,
          borderRadius: 14,
          borderWidth: 3,
          borderColor: "#ffffff",
          backgroundColor: hsvToHex(value),
          elevation: 4,
        }}
      />
      {/* Empty top layer takes the touches, so locationX/Y are wheel coordinates. */}
      <View
        style={{ position: "absolute", width: size, height: size }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        // Returning true blocks native gestures for this touch, so dragging on
        // the wheel picks a colour instead of moving the sheet.
        onResponderGrant={(e) => {
          pick(e);
          return true;
        }}
        onResponderMove={pick}
        onResponderRelease={onRelease}
      />
    </View>
  );
};
