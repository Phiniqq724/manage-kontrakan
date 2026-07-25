import { reportsApi, usersApi } from "@/services/api";
import type { Database } from "@/utils/supabase-types";
import ArrowBack from "@expo/material-symbols/arrow_back.xml";
import AttachFile from "@expo/material-symbols/attach_file.xml";
import { Host } from "@expo/ui";
import {
  Box,
  Column,
  HorizontalDivider,
  Icon,
  IconButton,
  ModalBottomSheet,
  OutlinedButton,
  PullToRefreshBox,
  RNHostView,
  Row,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  background,
  clickable,
  clip,
  fillMaxSize,
  fillMaxWidth,
  height,
  padding,
  Shapes,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Image } from "react-native";

type ReportRow = Database["public"]["Tables"]["reports"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

export default function AdminReportsScreen() {
  const colors = useMaterialColors();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [users, setUsers] = useState<Record<string, UserRow>>({});
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [repRes, userRes] = await Promise.all([
      reportsApi.getAll(),
      usersApi.getAll(),
    ]);
    const userMap: Record<string, UserRow> = {};
    (userRes.data ?? []).forEach((u) => {
      userMap[u.id] = u;
    });
    setUsers(userMap);
    const sorted = (repRes.data ?? []).sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime(),
    );
    setReports(sorted);
  }

  const onRefresh = () => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

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
          <Row
            verticalAlignment="center"
            horizontalArrangement={{ spacedBy: 4 }}
            modifiers={[fillMaxWidth()]}
          >
            <IconButton onClick={() => router.back()}>
              <Icon source={ArrowBack} tint={colors.onSurface} size={22} />
            </IconButton>
            <Column
              verticalArrangement={{ spacedBy: 2 }}
              modifiers={[weight(1)]}
            >
              <Text
                style={{ typography: "titleLarge", fontWeight: "bold" }}
                color={colors.onBackground}
              >
                Laporan
              </Text>
              <Text
                style={{ typography: "bodySmall" }}
                color={colors.onSurfaceVariant}
              >
                Semua laporan penghuni
              </Text>
            </Column>
          </Row>

          <Text
            style={{ typography: "labelLarge", fontWeight: "bold" }}
            color={colors.onSurfaceVariant}
          >
            {`${reports.length} laporan`}
          </Text>

          {reports.length === 0 && (
            <Text
              style={{ typography: "bodyMedium" }}
              color={colors.onSurfaceVariant}
            >
              Belum ada laporan masuk.
            </Text>
          )}

          <Column>
            {reports.map((r, i) => {
              const reporter = r.created_by ? users[r.created_by] : null;
              const suspect = r.suspect ? users[r.suspect] : null;
              return (
                <Column key={r.id}>
                  <Row
                    verticalAlignment="center"
                    horizontalArrangement="spaceBetween"
                    modifiers={[
                      fillMaxWidth(),
                      clickable(() => setSelected(r)),
                      padding(0, 12, 0, 12),
                    ]}
                  >
                    <Column
                      verticalArrangement={{ spacedBy: 2 }}
                      modifiers={[weight(1)]}
                    >
                      <Text
                        style={{ typography: "bodyLarge", fontWeight: "600" }}
                        color={colors.onSurface}
                      >
                        {r.title}
                      </Text>
                      <Text
                        style={{ typography: "bodySmall" }}
                        color={colors.onSurfaceVariant}
                      >
                        {r.suspect
                          ? `${reporter?.fullname ?? "Unknown"} → ${suspect?.fullname ?? "Unknown"}`
                          : `Laporan umum · ${reporter?.fullname ?? "Unknown"}`}
                      </Text>
                      {r.created_at && (
                        <Text
                          style={{ typography: "labelSmall" }}
                          color={colors.onSurfaceVariant}
                        >
                          {new Date(r.created_at).toLocaleDateString("id-ID")}
                        </Text>
                      )}
                    </Column>
                    {r.docs && (
                      <Icon
                        source={AttachFile}
                        tint={colors.onSurfaceVariant}
                        size={18}
                      />
                    )}
                  </Row>
                  {i < reports.length - 1 && (
                    <HorizontalDivider color={colors.outlineVariant} />
                  )}
                </Column>
              );
            })}
          </Column>
        </Column>
      </PullToRefreshBox>

      {selected && (
        <ModalBottomSheet onDismissRequest={() => setSelected(null)}>
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
                {selected.title}
              </Text>
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurfaceVariant}
              >
                {selected.suspect
                  ? `${users[selected.created_by ?? ""]?.fullname ?? "Unknown"} melaporkan ${users[selected.suspect]?.fullname ?? "Unknown"}`
                  : `Laporan umum dari ${users[selected.created_by ?? ""]?.fullname ?? "Unknown"}`}
              </Text>
            </Column>

            <HorizontalDivider color={colors.outlineVariant} />

            {selected.description && (
              <Text
                style={{ typography: "bodyMedium" }}
                color={colors.onSurface}
              >
                {selected.description}
              </Text>
            )}

            {selected.docs && (
              <Box
                modifiers={[
                  fillMaxWidth(),
                  height(220),
                  clip(Shapes.RoundedCorner(12)),
                  background(colors.surfaceContainerHighest),
                ]}
              >
                <RNHostView>
                  <Image
                    source={{ uri: selected.docs }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="contain"
                  />
                </RNHostView>
              </Box>
            )}

            <OutlinedButton
              onClick={() => setSelected(null)}
              modifiers={[fillMaxWidth()]}
            >
              <Text
                style={{ typography: "labelLarge" }}
                color={colors.onSurfaceVariant}
              >
                Tutup
              </Text>
            </OutlinedButton>
          </Column>
        </ModalBottomSheet>
      )}
    </Host>
  );
}
