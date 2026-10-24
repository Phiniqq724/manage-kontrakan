import { haptics } from "@/utils/haptics";
import { FormField } from "@/components/FormField";
import { FormSheet, SheetActions } from "@/components/FormSheet";
import { linkAccount } from "@/utils/multi-session";
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
      haptics.error();
      alert(err.message);
    } finally {
      setLinking(false);
    }
  };

  return (
    <FormSheet
      title="Tambah akun"
      subtitle="Masukkan email dan password akun yang mau ditautkan."
      onClose={linking ? () => {} : onClose}
    >
      <FormField
        label="Email akun tujuan"
        singleLine
        onValueChange={setEmail}
        enabled={!linking}
        keyboardOptions={{ keyboardType: "email", capitalization: "none" }}
      />
      <FormField
        label="Password akun tujuan"
        singleLine
        onValueChange={setPassword}
        enabled={!linking}
        visualTransformation="password"
      />
      <SheetActions
        onCancel={onClose}
        onSubmit={handleLink}
        submitLabel="Tautkan"
        enabled={canSubmit}
        loading={linking}
      />
    </FormSheet>
  );
}
