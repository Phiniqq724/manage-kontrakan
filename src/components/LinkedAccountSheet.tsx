import { ButtonContent } from "@/components/ButtonContent";
import { linkAccount } from "@/utils/multi-session";
import {
  Button,
  Column,
  ModalBottomSheet,
  OutlinedButton,
  OutlinedTextField,
  Row,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  fillMaxWidth,
  imePadding,
  padding,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";

export function AddAccountSheet({
  ownerId,
  onClose,
  onLinked,
}: {
  ownerId: string;
  onClose: () => void;
  onLinked: () => void;
}) {
  const colors = useMaterialColors();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [linking, setLinking] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  const handleLink = async () => {
    if (!canSubmit) return;
    setLinking(true);
    try {
      await linkAccount(ownerId, email.trim(), password);
      onLinked();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLinking(false);
    }
  };

  return (
    <ModalBottomSheet onDismissRequest={linking ? () => {} : onClose}>
      <Column
        verticalArrangement={{ spacedBy: 16 }}
        modifiers={[
          fillMaxWidth(),
          imePadding(),
          padding(24, 8, 24, 32),
        ]}
      >
        <Column verticalArrangement={{ spacedBy: 4 }}>
          <Text
            style={{ typography: "headlineSmall", fontWeight: "bold" }}
            color={colors.onSurface}
          >
            Tambah akun
          </Text>
          <Text
            style={{ typography: "bodyMedium" }}
            color={colors.onSurfaceVariant}
          >
            Masukkan email dan password akun yang mau ditautkan.
          </Text>
        </Column>

        <OutlinedTextField
          singleLine
          onValueChange={setEmail}
          enabled={!linking}
          keyboardOptions={{ keyboardType: "email", capitalization: "none" }}
          modifiers={[fillMaxWidth()]}
        >
          <OutlinedTextField.Label>
            <Text>Email akun tujuan</Text>
          </OutlinedTextField.Label>
        </OutlinedTextField>

        <OutlinedTextField
          singleLine
          onValueChange={setPassword}
          enabled={!linking}
          visualTransformation="password"
          modifiers={[fillMaxWidth()]}
        >
          <OutlinedTextField.Label>
            <Text>Password akun tujuan</Text>
          </OutlinedTextField.Label>
        </OutlinedTextField>

        <Row
          verticalAlignment="center"
          horizontalArrangement={{ spacedBy: 12 }}
          modifiers={[fillMaxWidth()]}
        >
          <OutlinedButton
            enabled={!linking}
            onClick={onClose}
            modifiers={[weight(1)]}
          >
            <Text style={{ typography: "labelLarge" }} color={colors.primary}>
              Batal
            </Text>
          </OutlinedButton>
          <Button
            enabled={canSubmit && !linking}
            onClick={handleLink}
            modifiers={[weight(1)]}
          >
            <ButtonContent
              loading={linking}
              enabled={canSubmit}
              label="Tautkan"
              color={colors.onPrimary}
            />
          </Button>
        </Row>
      </Column>
    </ModalBottomSheet>
  );
}
