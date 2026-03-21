"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { PlateDisplay } from "@/components/plate-display";
import { useAppStore } from "@/lib/store";
import { Plus, Trash2, ShieldCheck, ShieldAlert, Star } from "lucide-react";
import { format } from "date-fns";
import type { PlateRule, PlateRuleType } from "@/types";

const demoRules: PlateRule[] = [
  {
    id: "r-001",
    location_id: "loc-1",
    plate_number: "B 1 RI",
    rule_type: "vip",
    reason: "Government official vehicle",
    created_at: "2026-01-15T10:00:00Z",
    created_by: "Admin",
  },
  {
    id: "r-002",
    location_id: "loc-1",
    plate_number: "B 9999 ZZZ",
    rule_type: "blacklist",
    reason: "Multiple parking violations, unpaid fees",
    created_at: "2026-02-20T14:30:00Z",
    created_by: "Admin",
  },
  {
    id: "r-003",
    location_id: "loc-1",
    plate_number: "D 1234 MGR",
    rule_type: "whitelist",
    reason: "Building management vehicle",
    created_at: "2026-03-01T09:00:00Z",
    created_by: "Operator",
  },
  {
    id: "r-004",
    location_id: "loc-1",
    plate_number: "B 5555 CEO",
    rule_type: "vip",
    reason: "Company director",
    created_at: "2026-03-10T08:00:00Z",
    created_by: "Admin",
  },
];

const ruleTypeConfig: Record<
  PlateRuleType,
  { label: string; variant: "success" | "error" | "warning"; icon: React.ElementType }
> = {
  whitelist: { label: "Whitelist", variant: "success", icon: ShieldCheck },
  blacklist: { label: "Blacklist", variant: "error", icon: ShieldAlert },
  vip: { label: "VIP", variant: "warning", icon: Star },
};

export default function PlateRulesPage() {
  const { locale } = useAppStore();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<PlateRule | null>(null);
  const [newRule, setNewRule] = useState({
    plate_number: "",
    rule_type: "whitelist" as PlateRuleType,
    reason: "",
  });

  const t = (en: string, id: string) => (locale === "en" ? en : id);

  const handleAdd = () => {
    console.log("Add rule:", newRule);
    setAddDialogOpen(false);
    setNewRule({ plate_number: "", rule_type: "whitelist", reason: "" });
  };

  const handleDelete = () => {
    console.log("Delete rule:", selectedRule?.id);
    setDeleteDialogOpen(false);
    setSelectedRule(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-text-primary">
          {t("Plate Rules", "Aturan Plat")}
        </h1>
        <Button size="sm" className="gap-2" onClick={() => setAddDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          {t("Add Rule", "Tambah Aturan")}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("Plate Number", "Nomor Plat")}</TableHead>
                <TableHead>{t("Rule Type", "Jenis Aturan")}</TableHead>
                <TableHead>{t("Reason", "Alasan")}</TableHead>
                <TableHead>{t("Date Added", "Tanggal")}</TableHead>
                <TableHead>{t("Added By", "Oleh")}</TableHead>
                <TableHead>{t("Actions", "Aksi")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {demoRules.map((rule) => {
                const config = ruleTypeConfig[rule.rule_type];
                const IconComp = config.icon;
                return (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <PlateDisplay plate={rule.plate_number} size="sm" />
                    </TableCell>
                    <TableCell>
                      <Badge variant={config.variant} className="gap-1">
                        <IconComp className="h-3 w-3" />
                        {config.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-text-secondary max-w-[250px] truncate">
                      {rule.reason}
                    </TableCell>
                    <TableCell className="text-sm text-text-secondary">
                      {format(new Date(rule.created_at), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-sm text-text-secondary">
                      {rule.created_by}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-text-tertiary hover:text-error"
                        onClick={() => {
                          setSelectedRule(rule);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Add Rule Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("Add Plate Rule", "Tambah Aturan Plat")}</DialogTitle>
            <DialogDescription>
              {t(
                "Add a new plate rule for this location.",
                "Tambahkan aturan plat baru untuk lokasi ini."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-secondary">
                {t("Plate Number", "Nomor Plat")}
              </label>
              <Input
                value={newRule.plate_number}
                onChange={(e) =>
                  setNewRule({ ...newRule, plate_number: e.target.value.toUpperCase() })
                }
                placeholder="B 1234 ABC"
                className="font-mono tracking-wider"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-secondary">
                {t("Rule Type", "Jenis Aturan")}
              </label>
              <Select
                value={newRule.rule_type}
                onValueChange={(v) =>
                  setNewRule({ ...newRule, rule_type: v as PlateRuleType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whitelist">Whitelist</SelectItem>
                  <SelectItem value="blacklist">Blacklist</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-text-secondary">
                {t("Reason", "Alasan")}
              </label>
              <Input
                value={newRule.reason}
                onChange={(e) =>
                  setNewRule({ ...newRule, reason: e.target.value })
                }
                placeholder={t("Enter reason...", "Masukkan alasan...")}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              {t("Cancel", "Batal")}
            </Button>
            <Button onClick={handleAdd}>{t("Add Rule", "Tambah Aturan")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Delete Rule", "Hapus Aturan")}</DialogTitle>
            <DialogDescription>
              {t(
                "Are you sure you want to delete this rule?",
                "Apakah Anda yakin ingin menghapus aturan ini?"
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedRule && (
            <div className="py-2">
              <PlateDisplay plate={selectedRule.plate_number} />
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              {t("Cancel", "Batal")}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              {t("Delete", "Hapus")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
