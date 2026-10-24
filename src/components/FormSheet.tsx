import { useAppColors } from "@/components/AppHost";
import { ButtonContent } from "@/components/ButtonContent";
import {
  AnimatedVisibility,
  Button,
  Column,
  EnterTransition,
  ExitTransition,
  ModalBottomSheet,
  OutlinedButton,
  Row,
  Text,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  imePadding,
  padding,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import type { ReactNode } from "react";

/**
 * Folds away vertically. Sheet parts wrap themselves in this so one element
 * (e.g. the camera) can take over the whole sheet.
 */
export const Collapse = ({
  visible,
  children,
}: {
  visible: boolean;
  children: ReactNode;
}) => (
  <AnimatedVisibility
    visible={visible}
    enterTransition={EnterTransition.expandVertically().plus(
      EnterTransition.fadeIn(),
    )}
    exitTransition={ExitTransition.shrinkVertically().plus(
      ExitTransition.fadeOut(),
    )}
  >
    <Column verticalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth()]}>
      {children}
    </Column>
  </AnimatedVisibility>
);

/**
 * Standard bottom sheet: 24dp side padding, 16dp gaps, bold headline title with optional subtitle.
 * `focused` folds the title away and stops swipe-to-dismiss, for when one child fills the sheet.
 * `swipe = false` stops swipe-to-dismiss alone (e.g. while a child takes drags).
 * `skipPartial` opens it fully, so content that grows later is never cut off at half height.
 */
export const FormSheet = ({
  title,
  subtitle,
  onClose,
  focused = false,
  skipPartial = false,
  swipe = true,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  focused?: boolean;
  skipPartial?: boolean;
  swipe?: boolean;
  children: ReactNode;
}) => {
  const colors = useAppColors();
  return (
    <ModalBottomSheet
      onDismissRequest={onClose}
      sheetGesturesEnabled={swipe && !focused}
      skipPartiallyExpanded={skipPartial}
    >
      <Column
        verticalArrangement={{ spacedBy: 16 }}
        modifiers={[
          fillMaxWidth(),
          verticalScroll(),
          imePadding(),
          padding(24, 8, 24, 32),
        ]}
      >
        <Collapse visible={!focused}>
          <Column verticalArrangement={{ spacedBy: 4 }}>
            <Text
              style={{ typography: "headlineSmall", fontWeight: "bold" }}
              color={colors.onSurface}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
              >
                {subtitle}
              </Text>
            ) : null}
          </Column>
        </Collapse>
        {children}
      </Column>
    </ModalBottomSheet>
  );
};

/** Cancel (outlined) + submit (filled) buttons, equal width. Omit `onSubmit` for a close-only button. */
export const SheetActions = ({
  onCancel,
  cancelLabel = "Batal",
  cancelEnabled = true,
  destructiveCancel = false,
  destructive = false,
  onSubmit,
  submitLabel,
  enabled = true,
  loading = false,
}: {
  onCancel: () => void;
  cancelLabel?: string;
  cancelEnabled?: boolean;
  /** Render the cancel label in the error color (e.g. "Tolak"). */
  destructiveCancel?: boolean;
  /** Use the error color for the submit button (e.g. reporting someone). */
  destructive?: boolean;
  onSubmit?: () => void;
  submitLabel?: string;
  enabled?: boolean;
  loading?: boolean;
}) => {
  const colors = useAppColors();
  return (
    <Row
      verticalAlignment="center"
      horizontalArrangement={{ spacedBy: 12 }}
      modifiers={[fillMaxWidth()]}
    >
      <OutlinedButton
        enabled={cancelEnabled && !loading}
        onClick={onCancel}
        modifiers={[weight(1)]}
      >
        <Text
          style={{ typography: "labelLarge" }}
          color={destructiveCancel ? colors.error : colors.primary}
        >
          {cancelLabel}
        </Text>
      </OutlinedButton>
      {onSubmit && submitLabel ? (
        <Button
          enabled={enabled && !loading}
          onClick={onSubmit}
          colors={
            destructive
              ? { containerColor: colors.error, contentColor: colors.onError }
              : undefined
          }
          modifiers={[weight(1)]}
        >
          <ButtonContent
            loading={loading}
            enabled={enabled}
            label={submitLabel}
            color={destructive ? colors.onError : colors.onPrimary}
          />
        </Button>
      ) : null}
    </Row>
  );
};
