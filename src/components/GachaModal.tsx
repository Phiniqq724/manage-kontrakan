import { haptics } from "@/utils/haptics";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from "react-native";

import {
  buildReel,
  isRare,
  prizeHint,
  prizeLabel,
  prizesFor,
  REEL_ABOVE,
  type Prize,
  type PrizeTier,
} from "@/utils/motm";

import { useAppColors } from "./AppHost";

const ROW = 72;
const SPIN_MS = 4200;
// translateY that puts reel item `i` in the middle row.
const rowAt = (i: number) => ROW - i * ROW;
const LANDED = rowAt(REEL_ABOVE);
// Near miss: how far (in rows) the neighbour gets into the middle row.
const NEAR_MISS = 0.6;

/**
 * The ending tease, picked at random: the reel either slides past the
 * reward until the prize above almost lands, hangs, then slips back; or it
 * stalls with the prize below almost selected, waits, then creeps on.
 */
const nearMiss = (travel: Animated.Value) => {
  const overshoot = Math.random() < 0.5;
  const settle = Animated.spring(travel, {
    toValue: LANDED,
    friction: 6,
    tension: 60,
    useNativeDriver: true,
  });
  return [
    Animated.timing(travel, {
      // The reel moves down, so past the reward is +, short of it is -.
      toValue: LANDED + (overshoot ? 1 : -1) * NEAR_MISS * ROW,
      duration: SPIN_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }),
    Animated.delay(overshoot ? 450 : 650),
    overshoot
      ? settle
      : Animated.sequence([
          Animated.timing(travel, {
            toValue: LANDED + 0.1 * ROW,
            duration: 700,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          settle,
        ]),
  ];
};

/**
 * Slot-machine style reveal for the Member of the Month prize. The prize is
 * already decided by the server (`won`); the reel only animates toward it,
 * filled with prizes from the winner's `tier`.
 */
export const GachaModal = ({
  won,
  tier = "normal",
  onClose,
}: {
  won: Prize;
  tier?: PrizeTier;
  onClose: () => void;
}) => {
  const colors = useAppColors();
  const [reel] = useState(() => buildReel(won, 30, Math.random, prizesFor(tier)));
  const [done, setDone] = useState(false);
  // Fixed at open so a parent re-render can never restart the spin.
  const [winTier] = useState<PrizeTier>(() => (isRare(won) ? "jackpot" : tier));
  const travel = useRef(new Animated.Value(rowAt(reel.length - 1))).current;
  const pop = useRef(new Animated.Value(1)).current;
  const reveal = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // A light tick each time a new row passes the window.
    let row = Math.round(rowAt(reel.length - 1) / ROW);
    const id = travel.addListener(({ value }) => {
      const next = Math.round(value / ROW);
      if (next !== row) {
        row = next;
        haptics.reelTick();
      }
    });
    const spin = Animated.sequence([
      ...nearMiss(travel),
      Animated.timing(pop, { toValue: 1.08, duration: 120, useNativeDriver: true }),
      Animated.timing(pop, { toValue: 1, duration: 160, useNativeDriver: true }),
    ]);
    spin.start(({ finished }) => {
      if (!finished) return;
      haptics.win(winTier);
      setDone(true);
      Animated.timing(reveal, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    });
    return () => {
      spin.stop();
      travel.removeListener(id);
    };
  }, [travel, pop, reveal, reel.length, winTier]);

  return (
    <Modal
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={done ? onClose : undefined}
    >
      <View style={styles.root}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: 0.6 }]} />
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.onSurface }]}>Hadiah Member of the Month</Text>

          <Animated.View style={[styles.window, { transform: [{ scale: pop }] }]}>
            <Animated.View style={{ transform: [{ translateY: travel }] }}>
              {reel.map((item, i) => {
                // Rare jackpot in tertiary, 50k primary, 30k secondary, 25k neutral.
                const [bg, fg] = isRare(item)
                  ? [colors.tertiary, colors.onTertiary]
                  : item.amount === 50000
                    ? [colors.primaryContainer, colors.onPrimaryContainer]
                    : item.amount === 30000
                      ? [colors.secondaryContainer, colors.onSecondaryContainer]
                      : [colors.surfaceContainerHigh, colors.onSurface];
                return (
                  <View key={i} style={styles.row}>
                    <View
                      style={[
                        styles.tile,
                        {
                          backgroundColor: bg,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.tileText,
                          { color: fg },
                        ]}
                      >
                        {prizeLabel(item)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </Animated.View>
            <View
              pointerEvents="none"
              style={[styles.highlight, { borderColor: colors.primary }]}
            />
          </Animated.View>

          {done ? (
            <Animated.View style={[styles.result, { opacity: reveal }]}>
              <Text style={[styles.hint, { color: colors.onSurfaceVariant }]}>Selamat! Kamu dapat</Text>
              <Text style={[styles.prize, { color: isRare(won) ? colors.tertiary : colors.primary }]}>
                {prizeLabel(won)}
              </Text>
              <Text style={[styles.hint, { color: colors.onSurfaceVariant }]}>{prizeHint(won)}</Text>
              <Pressable
                onPress={onClose}
                style={[styles.button, { backgroundColor: colors.primary }]}
              >
                <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Mantap</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <Text style={[styles.hint, styles.spinning, { color: colors.onSurfaceVariant }]}>
              Mengacak hadiah...
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 380, borderRadius: 28, padding: 24, alignItems: "center" },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  window: { width: "100%", height: ROW * 3, overflow: "hidden" },
  row: { height: ROW, paddingVertical: 6 },
  tile: { flex: 1, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  tileText: { fontSize: 20, fontWeight: "700" },
  highlight: {
    position: "absolute",
    top: ROW,
    left: 0,
    right: 0,
    height: ROW,
    borderWidth: 2,
    borderRadius: 16,
  },
  spinning: { marginTop: 20 },
  result: { width: "100%", alignItems: "center", marginTop: 20, gap: 4 },
  hint: { fontSize: 14, textAlign: "center" },
  prize: { fontSize: 32, fontWeight: "800", textAlign: "center" },
  button: {
    width: "100%",
    height: 48,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  buttonText: { fontSize: 16, fontWeight: "700" },
});
