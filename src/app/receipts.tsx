import {
  formatRupiah,
  receiptCategoryInfo,
  ReceiptDetailSheet,
  ReceiptFormSheet,
  type ReceiptRow,
} from "@/components/ReceiptSheets";
import { receiptsApi, usersApi } from "@/services/api";
import { useAuth } from "@/utils/auth-context";
import Add from "@expo/material-symbols/add.xml";
import ArrowBack from "@expo/material-symbols/arrow_back.xml";
import Receipt from "@expo/material-symbols/receipt.xml";
import { Host } from "@expo/ui";
import {
  Box,
  Card,
  ExtendedFloatingActionButton,
  Icon,
  IconButton,
  PullToRefreshBox,
  Column,
  Row,
  Text,
  useMaterialColors,
} from "@expo/ui/jetpack-compose";
import {
  align,
  background,
  clickable,
  clip,
  fillMaxSize,
  fillMaxWidth,
  padding,
  paddingAll,
  Shapes,
  size,
  verticalScroll,
  weight,
} from "@expo/ui/jetpack-compose/modifiers";
import { router } from "expo-router";
import { useEffect, useState } from "react";

const firstName = (fullname: string) => fullname.split(" ")[0] ?? fullname;

type MonthGroup = {
  key: string;
  label: string;
  total: number;
  items: ReceiptRow[];
};

export default function ReceiptsScreen() {
  const { user } = useAuth();
  const colors = useMaterialColors();
  const isAdmin = user?.role === "admin";

  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [uploaderNames, setUploaderNames] = useState<Record<string, string>>(
    {},
  );
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<ReceiptRow | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [receiptsRes, usersRes] = await Promise.all([
      receiptsApi.getAll(),
      usersApi.getAll(),
    ]);
    setReceipts(receiptsRes.data ?? []);
    setUploaderNames(
      Object.fromEntries(
        (usersRes.data ?? []).map((u) => [u.id, u.fullname]),
      ),
    );
  }

  const onRefresh = () => {
    setRefreshing(true);
    loadData().finally(() => setRefreshing(false));
  };

  const monthGroups: MonthGroup[] = (() => {
    const map = new Map<string, ReceiptRow[]>();
    receipts.forEach((r) => {
      const key = r.created_at.slice(0, 7);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, items]) => ({
        key,
        label: new Date(`${key}-01`)
          .toLocaleDateString("id-ID", { month: "long", year: "numeric" })
          .toUpperCase(),
        total: items.reduce((sum, r) => sum + r.amount, 0),
        items,
      }));
  })();

  return (
    <Host style={{ flex: 1 }}>
      <Box modifiers={[fillMaxSize()]}>
        <PullToRefreshBox
          isRefreshing={refreshing}
          onRefresh={onRefresh}
          contentAlignment="topCenter"
          modifiers={[fillMaxSize(), background(colors.background)]}
        >
          <Column
            verticalArrangement={{ spacedBy: 24 }}
            modifiers={[
              fillMaxSize(),
              verticalScroll(),
              padding(16, 56, 16, 32),
            ]}
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
                  Kwitansi Bulanan
                </Text>
                <Text
                  style={{ typography: "bodySmall" }}
                  color={colors.onSurfaceVariant}
                >
                  Air, listrik, iuran desa, WiFi, dan lainnya
                </Text>
              </Column>
            </Row>

            {receipts.length === 0 ? (
              <Column
                horizontalAlignment="center"
                verticalArrangement={{ spacedBy: 12 }}
                modifiers={[fillMaxWidth(), padding(8, 40, 8, 40)]}
              >
                <Box
                  contentAlignment="center"
                  modifiers={[
                    size(72, 72),
                    clip(Shapes.RoundedCorner(36)),
                    background(colors.secondaryContainer),
                  ]}
                >
                  <Icon
                    source={Receipt}
                    tint={colors.onSecondaryContainer}
                    size={32}
                  />
                </Box>
                <Column
                  horizontalAlignment="center"
                  verticalArrangement={{ spacedBy: 2 }}
                >
                  <Text
                    style={{ typography: "bodyLarge", fontWeight: "bold" }}
                    color={colors.onSurface}
                  >
                    Belum ada kwitansi
                  </Text>
                  <Text
                    style={{ typography: "bodySmall", textAlign: "center" }}
                    color={colors.onSurfaceVariant}
                  >
                    {isAdmin
                      ? "Tambahkan kwitansi lewat tombol di bawah."
                      : "Kwitansi tagihan bulanan akan muncul di sini."}
                  </Text>
                </Column>
              </Column>
            ) : (
              monthGroups.map((group) => (
                <Column key={group.key} verticalArrangement={{ spacedBy: 10 }}>
                  <Row
                    horizontalArrangement="spaceBetween"
                    verticalAlignment="center"
                    modifiers={[fillMaxWidth()]}
                  >
                    <Text
                      style={{
                        typography: "labelMedium",
                        fontWeight: "bold",
                        letterSpacing: 0.5,
                      }}
                      color={colors.onSurfaceVariant}
                    >
                      {group.label}
                    </Text>
                    <Text
                      style={{ typography: "labelMedium", fontWeight: "bold" }}
                      color={colors.onSurfaceVariant}
                    >
                      {formatRupiah(group.total)}
                    </Text>
                  </Row>

                  {group.items.map((r) => {
                    const categoryInfo = receiptCategoryInfo(r.category);
                    const uploaderName = r.created_by
                      ? (uploaderNames[r.created_by] ?? "Seseorang")
                      : "Seseorang";
                    return (
                      <Card
                        key={r.id}
                        colors={{ containerColor: colors.surfaceContainerLow }}
                        modifiers={[
                          fillMaxWidth(),
                          clip(Shapes.RoundedCorner(18)),
                          clickable(() => setSelected(r)),
                        ]}
                      >
                        <Row
                          verticalAlignment="center"
                          horizontalArrangement={{ spacedBy: 12 }}
                          modifiers={[fillMaxWidth(), paddingAll(14)]}
                        >
                          <Box
                            contentAlignment="center"
                            modifiers={[
                              size(44, 44),
                              clip(Shapes.RoundedCorner(14)),
                              background(colors.secondaryContainer),
                            ]}
                          >
                            <Icon
                              source={categoryInfo.icon}
                              tint={colors.onSecondaryContainer}
                              size={20}
                            />
                          </Box>
                          <Column
                            verticalArrangement={{ spacedBy: 2 }}
                            modifiers={[weight(1)]}
                          >
                            <Text
                              style={{
                                typography: "bodyLarge",
                                fontWeight: "600",
                              }}
                              color={colors.onSurface}
                            >
                              {categoryInfo.label}
                            </Text>
                            <Text
                              style={{ typography: "bodySmall" }}
                              color={colors.onSurfaceVariant}
                            >
                              {`Diunggah oleh ${firstName(uploaderName)}`}
                            </Text>
                          </Column>
                          <Text
                            style={{
                              typography: "bodyLarge",
                              fontWeight: "bold",
                            }}
                            color={colors.onSurface}
                          >
                            {formatRupiah(r.amount)}
                          </Text>
                        </Row>
                      </Card>
                    );
                  })}
                </Column>
              ))
            )}
          </Column>
        </PullToRefreshBox>

        {isAdmin && (
          <ExtendedFloatingActionButton
            onClick={() => setFormOpen(true)}
            modifiers={[align("bottomEnd"), padding(0, 0, 20, 24)]}
          >
            <ExtendedFloatingActionButton.Icon>
              <Icon source={Add} size={20} />
            </ExtendedFloatingActionButton.Icon>
            <ExtendedFloatingActionButton.Text>
              <Text style={{ typography: "labelLarge", fontWeight: "bold" }}>
                Tambah Kwitansi
              </Text>
            </ExtendedFloatingActionButton.Text>
          </ExtendedFloatingActionButton>
        )}
      </Box>

      {formOpen && user && (
        <ReceiptFormSheet
          userId={user.id}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            loadData();
            setFormOpen(false);
          }}
        />
      )}

      {selected && (
        <ReceiptDetailSheet
          receipt={selected}
          uploaderName={
            selected.created_by
              ? (uploaderNames[selected.created_by] ?? "Seseorang")
              : "Seseorang"
          }
          isAdmin={isAdmin}
          onClose={() => setSelected(null)}
          onDeleted={() => {
            loadData();
            setSelected(null);
          }}
        />
      )}
    </Host>
  );
}
