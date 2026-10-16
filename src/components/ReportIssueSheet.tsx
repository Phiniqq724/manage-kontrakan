import { useAppColors } from "@/components/AppHost";
import { FormField } from "@/components/FormField";
import { FormSheet, SheetActions } from "@/components/FormSheet";
import { reportsApi } from "@/services/api";
import { sendPush } from "@/utils/notifications";
import { pickAndUploadImage } from "@/utils/upload";
import { OutlinedButton, Text } from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
import { useState } from "react";

/** General report to the admin (app or house issue, not about a person). */
export function ReportIssueSheet({
  userId,
  userFullname,
  onClose,
}: {
  userId: string;
  userFullname: string;
  onClose: () => void;
}) {
  const colors = useAppColors();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [evidenceUri, setEvidenceUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handlePickEvidence = async () => {
    try {
      const url = await pickAndUploadImage("report-evidence", userId);
      if (url) setEvidenceUri(url);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert("Judul laporan wajib diisi.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await reportsApi.create({
        title,
        description: desc,
        suspect: null,
        created_by: userId,
        docs: evidenceUri,
      });
      if (error) throw error;
      onClose();
      await sendPush({
        recipients: "admin",
        title: "Laporan Baru",
        body: `${userFullname} membuat laporan: ${title}.`,
      });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormSheet
      title="Buat laporan"
      subtitle="Laporkan masalah aplikasi atau kontrakan secara umum"
      onClose={onClose}
    >
      <FormField
        label="Judul laporan"
        singleLine
        onValueChange={setTitle}
        keyboardOptions={{ capitalization: "sentences" }}
      />

      <FormField
        label="Deskripsi"
        onValueChange={setDesc}
        minLines={3}
        keyboardOptions={{ capitalization: "sentences" }}
      />

      <OutlinedButton
        onClick={handlePickEvidence}
        modifiers={[fillMaxWidth()]}
      >
        <Text style={{ typography: "labelLarge" }} color={colors.primary}>
          {evidenceUri ? "Bukti terlampir" : "Lampirkan bukti (opsional)"}
        </Text>
      </OutlinedButton>

      <SheetActions
        onCancel={onClose}
        onSubmit={handleSubmit}
        submitLabel="Kirim laporan"
        enabled={title.trim().length > 0}
        loading={submitting}
      />
    </FormSheet>
  );
}
