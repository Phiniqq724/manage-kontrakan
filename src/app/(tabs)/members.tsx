import { Avatar, avatarColorFor } from "@/components/Avatar";
import { ButtonContent } from "@/components/ButtonContent";
import { kamarApi, reportsApi, usersApi } from "@/services/api";
import { useAuth } from "@/utils/auth-context";
import { getAdminToken, sendPushNotification } from "@/utils/notifications";
import type { Database } from "@/utils/supabase-types";
import { pickAndUploadImage } from "@/utils/upload";
import Chat from "@expo/material-symbols/chat.xml";
import Flag from "@expo/material-symbols/flag.xml";
import Search from "@expo/material-symbols/search.xml";
import { Host } from "@expo/ui";
import {
  Button,
  Card,
  Column,
  DockedSearchBar,
  Icon,
  IconButton,
  ModalBottomSheet,
  OutlinedButton,
  OutlinedTextField,
  PullToRefreshBox,
  Row,
  Text,
  TextButton,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clip,
  fillMaxSize,
  fillMaxWidth,
  padding,
  paddingAll,
  Shapes,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { useEffect, useState } from "react";
import { Linking } from "react-native";

type UserRow = Database["public"]["Tables"]["users"]["Row"];
type KamarRow = Database["public"]["Tables"]["kamar"]["Row"];

function kamarLabel(k: KamarRow | undefined) {
  if (!k) return null;
  return k.description
    ? `Kamar ${k.room_code} · ${k.description}`
    : `Kamar ${k.room_code}`;
}

export default function MembersScreen() {
  const { user: currentUser } = useAuth();
  const colors = useMaterialColors();

  const [members, setMembers] = useState<UserRow[]>([]);
  const [kamarMap, setKamarMap] = useState<Record<string, KamarRow>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");

  const [reportOpen, setReportOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<UserRow | null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [evidenceUri, setEvidenceUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [usersRes, kamarRes] = await Promise.all([
      usersApi.getAll(),
      kamarApi.getAll(),
    ]);
    if (usersRes.data) setMembers(usersRes.data);
    if (kamarRes.data) {
      const map: Record<string, KamarRow> = {};
      for (const k of kamarRes.data) {
        if (k.user_id) map[k.user_id] = k;
      }
      setKamarMap(map);
    }
  }

  const onRefresh = () => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

  const openReport = (member: UserRow) => {
    setSelectedMember(member);
    setTitle("");
    setDesc("");
    setEvidenceUri(null);
    setReportOpen(true);
  };

  const handlePickEvidence = async () => {
    try {
      const url = await pickAndUploadImage(
        "report-evidence",
        currentUser?.id ?? "anon",
      );
      if (url) setEvidenceUri(url);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSubmitReport = async () => {
    if (!title.trim()) {
      alert("Judul laporan wajib diisi.");
      return;
    }
    if (!currentUser || !selectedMember) return;
    setSubmitting(true);
    try {
      const { error } = await reportsApi.create({
        title,
        description: desc,
        suspect: selectedMember.id,
        created_by: currentUser.id,
        docs: evidenceUri,
      });
      if (error) throw error;
      setReportOpen(false);
      const adminToken = await getAdminToken();
      if (adminToken) {
        await sendPushNotification(
          adminToken,
          "Laporan Baru",
          `${currentUser.fullname} melaporkan ${selectedMember.fullname}: ${title}.`,
        );
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMembers = members
    .filter((m) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const kamar = kamarMap[m.id];
      return (
        m.fullname.toLowerCase().includes(q) ||
        kamar?.room_code.toLowerCase().includes(q) ||
        kamar?.description?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (a.id === currentUser?.id) return -1;
      if (b.id === currentUser?.id) return 1;
      return a.fullname.localeCompare(b.fullname);
    });

  return (
    <Host style={{ flex: 1 }}>
      <PullToRefreshBox
        isRefreshing={refreshing}
        onRefresh={onRefresh}
        contentAlignment="topCenter"
        modifiers={[fillMaxSize(), background(colors.background)]}
      >
        <Column
          verticalArrangement={{ spacedBy: 16 }}
          modifiers={[fillMaxSize(), verticalScroll(), padding(16, 56, 16, 32)]}
        >
          <Text
            style={{ typography: "headlineMedium", fontWeight: "bold" }}
            color={colors.onBackground}
          >
            Penghuni
          </Text>

          <DockedSearchBar
            onQueryChange={setQuery}
            modifiers={[fillMaxWidth()]}
          >
            <DockedSearchBar.Placeholder>
              <Text>Cari penghuni</Text>
            </DockedSearchBar.Placeholder>
            <DockedSearchBar.LeadingIcon>
              <Icon source={Search} tint={colors.onSurfaceVariant} size={20} />
            </DockedSearchBar.LeadingIcon>
          </DockedSearchBar>

          <Column verticalArrangement={{ spacedBy: 12 }}>
            {filteredMembers.length === 0 && (
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
              >
                Tidak ada penghuni yang cocok.
              </Text>
            )}
            {filteredMembers.map((m) => {
              const isSelf = m.id === currentUser?.id;
              const room = kamarLabel(kamarMap[m.id]);

              return (
                <Card
                  key={m.id}
                  colors={{ containerColor: colors.surfaceContainerLow }}
                  modifiers={[fillMaxWidth(), clip(Shapes.RoundedCorner(18))]}
                >
                  <Row
                    verticalAlignment="center"
                    horizontalArrangement={{ spacedBy: 12 }}
                    modifiers={[paddingAll(16)]}
                  >
                    <Avatar
                      fullname={m.fullname}
                      avatarUrl={m.avatar_url}
                      diameter={44}
                      colors={avatarColorFor(m.id, colors)}
                    />
                    <Column
                      verticalArrangement={{ spacedBy: 2 }}
                      modifiers={[weight(1)]}
                    >
                      <Row
                        verticalAlignment="center"
                        horizontalArrangement={{ spacedBy: 8 }}
                      >
                        <Text
                          style={{
                            typography: "bodyLarge",
                            fontWeight: "bold",
                          }}
                          color={colors.onSurface}
                        >
                          {m.fullname}
                        </Text>
                        {isSelf && (
                          <Row
                            modifiers={[
                              clip(Shapes.RoundedCorner(8)),
                              background(colors.primaryContainer),
                              padding(8, 2, 8, 2),
                            ]}
                          >
                            <Text
                              style={{
                                typography: "labelSmall",
                                fontWeight: "bold",
                              }}
                              color={colors.onPrimaryContainer}
                            >
                              kamu
                            </Text>
                          </Row>
                        )}
                      </Row>
                      <Text
                        style={{ typography: "bodySmall" }}
                        color={colors.onSurfaceVariant}
                      >
                        {room ?? "Belum ada kamar"}
                      </Text>
                    </Column>

                    {isSelf ? (
                      m.contact && <></>
                    ) : (
                      <Row horizontalArrangement={{ spacedBy: 8 }}>
                        {m.contact && (
                          <IconButton
                            onClick={() =>
                              Linking.openURL(
                                `https://wa.me/62${m.contact!.slice(1)}`,
                              )
                            }
                          >
                            <Icon
                              source={Chat}
                              tint={colors.onSurfaceVariant}
                              size={20}
                            />
                          </IconButton>
                        )}
                        {m.role !== "admin" && (
                          <IconButton onClick={() => openReport(m)}>
                            <Icon source={Flag} tint={colors.error} size={20} />
                          </IconButton>
                        )}
                      </Row>
                    )}
                  </Row>
                </Card>
              );
            })}
          </Column>
        </Column>
      </PullToRefreshBox>

      {reportOpen && (
        <ModalBottomSheet onDismissRequest={() => setReportOpen(false)}>
          <Column
            verticalArrangement={{ spacedBy: 16 }}
            modifiers={[
              fillMaxWidth(),
              verticalScroll(),
              padding(24, 8, 24, 32),
            ]}
          >
            <Column verticalArrangement={{ spacedBy: 4 }}>
              <Text
                style={{ typography: "headlineSmall", fontWeight: "bold" }}
                color={colors.onSurface}
              >
                Laporkan penghuni
              </Text>
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
              >
                {selectedMember?.fullname}
              </Text>
            </Column>

            <OutlinedTextField
              singleLine
              onValueChange={setTitle}
              keyboardOptions={{ capitalization: "sentences" }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>Judul laporan</Text>
              </OutlinedTextField.Label>
            </OutlinedTextField>

            <OutlinedTextField
              onValueChange={setDesc}
              minLines={3}
              keyboardOptions={{ capitalization: "sentences" }}
              modifiers={[fillMaxWidth()]}
            >
              <OutlinedTextField.Label>
                <Text>Deskripsi</Text>
              </OutlinedTextField.Label>
            </OutlinedTextField>

            <OutlinedButton
              onClick={handlePickEvidence}
              modifiers={[fillMaxWidth()]}
            >
              <Text style={{ typography: "labelLarge" }} color={colors.primary}>
                {evidenceUri ? "Bukti terlampir" : "Lampirkan bukti (opsional)"}
              </Text>
            </OutlinedButton>

            <Row
              verticalAlignment="center"
              horizontalArrangement={{ spacedBy: 12 }}
              modifiers={[fillMaxWidth()]}
            >
              <TextButton
                onClick={() => setReportOpen(false)}
                modifiers={[weight(1)]}
              >
                <Text
                  style={{ typography: "labelLarge" }}
                  color={colors.onSurfaceVariant}
                >
                  Batal
                </Text>
              </TextButton>
              <Button
                enabled={!submitting}
                onClick={handleSubmitReport}
                colors={{
                  containerColor: colors.error,
                  contentColor: colors.onError,
                }}
                modifiers={[weight(1)]}
              >
                <ButtonContent
                  loading={submitting}
                  label="Kirim laporan"
                  color={colors.onError}
                />
              </Button>
            </Row>
          </Column>
        </ModalBottomSheet>
      )}
    </Host>
  );
}
