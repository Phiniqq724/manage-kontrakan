import { haptics } from "@/utils/haptics";
import { useAppColors } from "@/components/AppHost";
import { FormField } from "@/components/FormField";
import { FormSheet, SheetActions } from "@/components/FormSheet";
import { usersApi } from "@/services/api";
import {
  calcNewMemberShare,
  DEFAULT_YEARLY_RENT,
  monthsLeftInContract,
  parseAmount,
} from "@/utils/member-share";
import { seedTextField } from "@/utils/seed-text-field";
import {
  Checkbox,
  Column,
  Row,
  Text,
  type TextFieldRef,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clip,
  fillMaxWidth,
  paddingAll,
  Shapes,
  toggleable,
} from "@expo/ui/jetpack-compose/modifiers";
import { useEffect, useRef, useState } from "react";

const DEFAULT_PASSWORD = "Kontrakan123!";
const rupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

/**
 * Admin form for adding a member: account details, the rent split for the
 * months they stay, and an optional custom password (default otherwise).
 */
export const AddMemberSheet = ({
  currentMembers,
  onClose,
  onAdded,
}: {
  /** Paying members before the new one joins. */
  currentMembers: number;
  onClose: () => void;
  onAdded: () => void;
}) => {
  const colors = useAppColors();
  const [form, setForm] = useState({
    fullname: "",
    username: "",
    email: "",
    contact: "",
    password: "",
  });
  const [rentText, setRentText] = useState(String(DEFAULT_YEARLY_RENT));
  const [monthsText, setMonthsText] = useState(String(monthsLeftInContract()));
  const [customPassword, setCustomPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  const rentRef = useRef<TextFieldRef>(null);
  const monthsRef = useRef<TextFieldRef>(null);
  useEffect(() => {
    seedTextField(rentRef, rentText);
    seedTextField(monthsRef, monthsText);
    // Seed the native fields once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const months = parseAmount(monthsText);
  const share = calcNewMemberShare(
    parseAmount(rentText),
    currentMembers,
    months,
  );
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async () => {
    const { fullname, username, email, contact, password } = form;
    if (!fullname.trim() || !username.trim() || !email.trim()) {
      alert("Nama, username, dan email wajib diisi.");
      return;
    }
    if (customPassword && password.length < 8) {
      alert("Password minimal 8 karakter.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await usersApi.createMember({
        fullname: fullname.trim(),
        username: username.trim(),
        email: email.trim(),
        contact: contact.trim() || null,
        password: customPassword ? password : undefined,
      });
      if (error) {
        // The function's JSON body has the real reason (e.g. email already used).
        const body = await error.context?.json?.().catch(() => null);
        throw new Error(body?.error ?? error.message);
      }
      haptics.success();
      alert(
        `${fullname.trim()} ditambahkan.` +
          (customPassword ? "" : ` Password awal: ${DEFAULT_PASSWORD}`),
      );
      onAdded();
      onClose();
    } catch (err: any) {
      haptics.error();
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const summary: [string, string][] = [
    [
      `Sewa per orang (${currentMembers} orang)`,
      `${rupiah(share.yearlyBefore)} / thn`,
    ],
    [
      `Setelah ${currentMembers + 1} orang`,
      `${rupiah(share.yearlyAfter)} / thn`,
    ],
    [`Penghuni baru bayar (${months} bulan)`, rupiah(share.newMemberPays)],
    [`Tiap penghuni lama terima`, rupiah(share.eachCurrentReceives)],
  ];

  return (
    <FormSheet title="Tambah penghuni" onClose={onClose}>
      <FormField
        label="Nama lengkap"
        singleLine
        enabled={!saving}
        onValueChange={set("fullname")}
        keyboardOptions={{ capitalization: "words" }}
      />
      <FormField
        label="Username"
        singleLine
        enabled={!saving}
        onValueChange={set("username")}
        keyboardOptions={{ capitalization: "none" }}
      />
      <FormField
        label="Email"
        singleLine
        enabled={!saving}
        onValueChange={set("email")}
        keyboardOptions={{ keyboardType: "email", capitalization: "none" }}
      />
      <FormField
        label="Kontak (opsional)"
        singleLine
        enabled={!saving}
        onValueChange={set("contact")}
        keyboardOptions={{ keyboardType: "phone" }}
      />

      <Row
        horizontalArrangement={{ spacedBy: 12 }}
        modifiers={[fillMaxWidth()]}
      >
        <Column modifiers={[fillMaxWidth(0.62)]}>
          <FormField
            ref={rentRef}
            label="Sewa per tahun (Rp)"
            singleLine
            enabled={!saving}
            onValueChange={setRentText}
            keyboardOptions={{ keyboardType: "number" }}
          />
        </Column>
        <FormField
          ref={monthsRef}
          label="Sisa kontrak (bulan)"
          singleLine
          enabled={!saving}
          onValueChange={setMonthsText}
          keyboardOptions={{ keyboardType: "number" }}
        />
      </Row>

      <Column
        verticalArrangement={{ spacedBy: 8 }}
        modifiers={[
          fillMaxWidth(),
          clip(Shapes.RoundedCorner(16)),
          background(colors.surfaceContainerHigh),
          paddingAll(16),
        ]}
      >
        {summary.map(([label, value]) => (
          <Row
            key={label}
            horizontalArrangement="spaceBetween"
            modifiers={[fillMaxWidth()]}
          >
            <Text
              style={{ typography: "bodyMedium" }}
              color={colors.onSurfaceVariant}
            >
              {label}
            </Text>
            <Text
              style={{ typography: "bodyMedium", fontWeight: "bold" }}
              color={colors.onSurface}
            >
              {value}
            </Text>
          </Row>
        ))}
      </Column>

      <Row
        verticalAlignment="center"
        horizontalArrangement={{ spacedBy: 8 }}
        modifiers={[
          toggleable(customPassword, () => {
            haptics.toggle(!customPassword);
            setCustomPassword((v) => !v);
          }, {
            role: "checkbox",
          }),
        ]}
      >
        <Checkbox value={customPassword} />
        <Text
          style={{ typography: "bodyMedium" }}
          color={colors.onSurfaceVariant}
        >
          Atur password sendiri
        </Text>
      </Row>
      {customPassword ? (
        <FormField
          label="Password (min. 8 karakter)"
          singleLine
          enabled={!saving}
          onValueChange={set("password")}
          visualTransformation="password"
          keyboardOptions={{ keyboardType: "password" }}
        />
      ) : (
        <Text
          style={{ typography: "bodySmall" }}
          color={colors.onSurfaceVariant}
        >
          {`Password awal: ${DEFAULT_PASSWORD}`}
        </Text>
      )}

      <SheetActions
        onCancel={onClose}
        onSubmit={handleSubmit}
        submitLabel="Tambah"
        loading={saving}
      />
    </FormSheet>
  );
};
