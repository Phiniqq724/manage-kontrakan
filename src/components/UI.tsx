import { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors, FontSize, Radius, Spacing } from "../constants/theme";

// ─── Rule Divider ────────────────────────────────────────────────
export function Rule({ style }: { style?: ViewStyle }) {
  return <View style={[styles.rule, style]} />;
}

// ─── Section Header ──────────────────────────────────────────────
export function SectionHeader({
  label,
  action,
  onAction,
}: {
  label: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>
      {action && (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── List Row ────────────────────────────────────────────────────
export function ListRow({
  left,
  right,
  sub,
  onPress,
  last,
  accent,
  danger,
}: {
  left: string;
  right?: string;
  sub?: string;
  onPress?: () => void;
  last?: boolean;
  accent?: boolean;
  danger?: boolean;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <>
      <Wrapper style={styles.listRow} onPress={onPress} activeOpacity={0.6}>
        <View style={styles.listRowLeft}>
          <Text
            style={[styles.listRowTitle, danger && styles.dangerText]}
            numberOfLines={1}
          >
            {left}
          </Text>
          {sub && (
            <Text style={styles.listRowSub} numberOfLines={1}>
              {sub}
            </Text>
          )}
        </View>
        {right && (
          <Text
            style={[
              styles.listRowRight,
              accent && styles.accentText,
              danger && styles.dangerText,
            ]}
          >
            {right}
          </Text>
        )}
      </Wrapper>
      {!last && <Rule />}
    </>
  );
}

// ─── Status Badge ────────────────────────────────────────────────
export function Badge({
  label,
  type = "default",
}: {
  label: string;
  type?: "default" | "success" | "warning" | "danger" | "muted";
}) {
  const badgeStyle = {
    default: { bg: Colors.surface, text: Colors.text },
    success: { bg: Colors.sageLight, text: Colors.sage },
    warning: { bg: "#F0E8C4", text: "#8C7A3A" },
    danger: { bg: Colors.dangerLight, text: Colors.danger },
    muted: { bg: Colors.border, text: Colors.textMuted },
  }[type];

  return (
    <View style={[styles.badge, { backgroundColor: badgeStyle.bg }]}>
      <Text style={[styles.badgeText, { color: badgeStyle.text }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────
export function StatCard({
  value,
  label,
  sub,
}: {
  value: string;
  label: string;
  sub?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  );
}

// ─── Primary Button ──────────────────────────────────────────────
export function PrimaryButton({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.primaryBtn, danger && styles.dangerBtn]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={styles.primaryBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Ghost Button ────────────────────────────────────────────────
export function GhostButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.ghostBtn}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <Text style={styles.ghostBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Input Field ─────────────────────────────────────────────────
import { TextInput, TextInputProps } from "react-native";

export function Field({ label, secureTextEntry, ...props }: TextInputProps & { label: string }) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = secureTextEntry === true;

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label.toUpperCase()}</Text>
      <Rule />
      <View style={styles.fieldRow}>
        <TextInput
          style={styles.fieldInput}
          placeholderTextColor={Colors.textFaint}
          secureTextEntry={isPassword && !revealed}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity onPress={() => setRevealed((v) => !v)} style={styles.eyeBtn}>
            <Ionicons
              name={revealed ? "eye-off-outline" : "eye-outline"}
              size={18}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>
      <Rule />
    </View>
  );
}

// ─── Page Header ─────────────────────────────────────────────────
export function PageHeader({
  title,
  subtitle,
  topInset,
}: {
  title: string;
  subtitle?: string;
  /** Overrides the default top padding — pass 60 to match the tab-root screens (Home/Profile). */
  topInset?: number;
}) {
  return (
    <View style={[styles.pageHeader, topInset != null && { paddingTop: topInset }]}>
      <Text style={styles.pageTitle}>{title}</Text>
      {subtitle && <Text style={styles.pageSubtitle}>{subtitle}</Text>}
      <Rule style={{ marginTop: Spacing.md }} />
    </View>
  );
}

// ─── Logbook Row (date-stamped entry style) ──────────────────────
export function LogRow({
  date,
  title,
  meta,
  badge,
  badgeType,
  onPress,
}: {
  date: string;
  title: string;
  meta?: string;
  badge?: string;
  badgeType?: "default" | "success" | "warning" | "danger" | "muted";
  onPress?: () => void;
}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper style={styles.logRow} onPress={onPress} activeOpacity={0.6}>
      <View style={styles.logDate}>
        <Text style={styles.logDateText}>{date}</Text>
      </View>
      <View style={styles.logBody}>
        <View style={styles.logBodyTop}>
          <Text style={styles.logTitle} numberOfLines={1}>
            {title}
          </Text>
          {badge && <Badge label={badge} type={badgeType} />}
        </View>
        {meta && <Text style={styles.logMeta}>{meta}</Text>}
      </View>
    </Wrapper>
  );
}

const styles = StyleSheet.create({
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    width: "100%",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  sectionLabel: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 1.5,
  },
  sectionAction: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.accent,
    letterSpacing: 1,
  },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    minHeight: 52,
  },
  listRowLeft: { flex: 1, marginRight: Spacing.sm },
  listRowTitle: { fontSize: FontSize.base, color: Colors.text },
  listRowSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  listRowRight: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  accentText: { color: Colors.accent },
  dangerText: { color: Colors.danger },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.sm,
  },
  badgeText: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    letterSpacing: 0.5,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  statValue: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xxl,
    color: Colors.text,
  },
  statLabel: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  statSub: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.accent,
    marginTop: 4,
  },
  primaryBtn: {
    backgroundColor: Colors.text,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    borderRadius: Radius.sm,
  },
  dangerBtn: { backgroundColor: Colors.danger },
  primaryBtnText: {
    fontFamily: "SpaceMono",
    color: Colors.bg,
    fontSize: FontSize.sm,
    letterSpacing: 1.5,
  },
  ghostBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.borderStrong,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    borderRadius: Radius.sm,
  },
  ghostBtnText: {
    fontFamily: "SpaceMono",
    color: Colors.text,
    fontSize: FontSize.sm,
    letterSpacing: 1.5,
  },
  field: { marginBottom: Spacing.lg },
  fieldLabel: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: Spacing.xs,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  fieldInput: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    paddingVertical: Spacing.sm,
  },
  eyeBtn: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  pageHeader: { paddingHorizontal: Spacing.md, paddingTop: Spacing.lg },
  pageTitle: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xl,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
  },
  logRow: {
    flexDirection: "row",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  logDate: { width: 52, alignItems: "center", paddingTop: 2 },
  logDateText: {
    fontFamily: "SpaceMono",
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 16,
  },
  logBody: { flex: 1 },
  logBodyTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.sm,
  },
  logTitle: { flex: 1, fontSize: FontSize.base, color: Colors.text },
  logMeta: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 3 },
});
