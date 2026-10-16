import { useAppColors } from "@/components/AppHost";
import Schedule from "@expo/material-symbols/schedule.xml";
import {
  Column,
  DatePickerDialog,
  Icon,
  OutlinedCard,
  Row,
  Text,
  TimePickerDialog,
} from "@expo/ui/jetpack-compose";
import {
  clickable,
  fillMaxWidth,
  padding,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";

/** "16 Okt 2026 · 19.30" */
export const formatDateTime = (d: Date) =>
  `${d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })} · ${d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`;

/**
 * Date-and-time input: a tappable outlined row showing the label and value.
 * Tapping opens the Material date dialog, then the time dialog, and reports
 * the combined Date once both are picked.
 */
export const DateTimeField = ({
  label,
  value,
  onChange,
  placeholder = "Pilih tanggal & waktu",
  minDate,
}: {
  label: string;
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  /** Earliest selectable day; earlier days are greyed out in the calendar. */
  minDate?: Date;
}) => {
  const colors = useAppColors();
  const [step, setStep] = useState<"date" | "time" | null>(null);
  // Fixed while a dialog is open so re-renders don't reset the picker.
  const [draft, setDraft] = useState<Date>(() => new Date());

  const open = () => {
    setDraft(value ?? new Date());
    setStep("date");
  };

  return (
    <>
      <OutlinedCard modifiers={[fillMaxWidth(), clickable(open)]}>
        <Row
          verticalAlignment="center"
          horizontalArrangement="spaceBetween"
          modifiers={[fillMaxWidth(), padding(16, 14, 16, 14)]}
        >
          <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
            <Text
              style={{ typography: "labelMedium" }}
              color={colors.onSurfaceVariant}
              maxLines={1}
              overflow="ellipsis"
            >
              {label}
            </Text>
            <Text
              style={{ typography: "bodyLarge" }}
              color={value ? colors.onSurface : colors.onSurfaceVariant}
              maxLines={1}
              overflow="ellipsis"
            >
              {value ? formatDateTime(value) : placeholder}
            </Text>
          </Column>
          <Icon source={Schedule} tint={colors.onSurfaceVariant} size={20} />
        </Row>
      </OutlinedCard>

      {step === "date" && (
        <DatePickerDialog
          initialDate={draft.toISOString()}
          selectableDates={minDate ? { start: minDate } : undefined}
          onDateSelected={(d) => {
            const next = new Date(draft);
            next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
            setDraft(next);
            setStep("time");
          }}
          onDismissRequest={() => setStep(null)}
        />
      )}
      {step === "time" && (
        <TimePickerDialog
          initialDate={draft.toISOString()}
          is24Hour
          onDateSelected={(t) => {
            const next = new Date(draft);
            next.setHours(t.getHours(), t.getMinutes(), 0, 0);
            setStep(null);
            onChange(next);
          }}
          onDismissRequest={() => setStep(null)}
        />
      )}
    </>
  );
};
