import { useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  MagnifyingGlass,
  Plus,
  Export,
  Star,
  Phone,
  Envelope,
  MapPin,
  Buildings,
  ArrowsClockwise,
  SpinnerGap,
} from "@phosphor-icons/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackButton } from "@/components/BackButton";
import { useContractors } from "@/hooks/useContractors";
import { toast } from "sonner";

interface ContractorsPageProps {
  onNavigate: (page: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  contacted: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  qualified: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  converted: "bg-green-500/20 text-green-400 border-green-500/30",
  lost: "bg-red-500/20 text-red-400 border-red-500/30",
};

export function ContractorsPage({ onNavigate }: ContractorsPageProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState<"table" | "cards">("table");

  const { contractors, total, loading, refresh } = useContractors({
    status: statusFilter !== "all" ? statusFilter : undefined,
    search: search || undefined,
    limit: 100,
  });

  const filtered = contractors;

  const stats = {
    total,
    new: contractors.filter((c) => c.status === "new").length,
    contacted: contractors.filter((c) => c.status === "contacted").length,
    qualified: contractors.filter((c) => c.status === "qualified").length,
    converted: contractors.filter((c) => c.status === "converted").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton onBack={() => onNavigate("home")} />
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Contractors Database
            </h1>
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Loading real scraped contractors…"
                : `${total.toLocaleString()} real scraped contractors — live from shadow scraper`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => toast.info("Export coming soon")}
          >
            <Export size={16} className="mr-2" />
            Export
          </Button>
          <Button
            size="sm"
            onClick={() => toast.info("Add contractor coming soon")}
          >
            <Plus size={16} className="mr-2" />
            Add Contractor
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total", value: total, color: "text-foreground" },
          { label: "New", value: stats.new, color: "text-blue-400" },
          {
            label: "Contacted",
            value: stats.contacted,
            color: "text-yellow-400",
          },
          {
            label: "Qualified",
            value: stats.qualified,
            color: "text-purple-400",
          },
          {
            label: "Converted",
            value: stats.converted,
            color: "text-green-400",
          },
        ].map((stat) => (
          <motion.div key={stat.label} whileHover={{ scale: 1.02 }}>
            <Card>
              <CardContent className="p-4 text-center">
                <div className={`text-2xl font-bold ${stat.color}`}>
                  {loading ? "…" : stat.value.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stat.label}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search contractors by name, city, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="converted">Converted</option>
            <option value="lost">Lost</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              refresh();
            }}
            title="Refresh from API"
          >
            {loading ? (
              <SpinnerGap size={16} className="animate-spin" />
            ) : (
              <ArrowsClockwise size={16} />
            )}
          </Button>
        </div>
        <div className="flex gap-1 border border-border rounded-md p-1">
          <Button
            variant={view === "table" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("table")}
          >
            Table
          </Button>
          <Button
            variant={view === "cards" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("cards")}
          >
            Cards
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-3">
          <SpinnerGap size={24} className="animate-spin" />
          <span>Loading real contractor leads from pipeline…</span>
        </div>
      )}

      {/* Table View */}
      {!loading && view === "table" && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-muted-foreground font-medium">
                    Company
                  </th>
                  <th className="text-left p-4 text-muted-foreground font-medium">
                    Contact
                  </th>
                  <th className="text-left p-4 text-muted-foreground font-medium">
                    Location
                  </th>
                  <th className="text-left p-4 text-muted-foreground font-medium">
                    Category
                  </th>
                  <th className="text-left p-4 text-muted-foreground font-medium">
                    Status
                  </th>
                  <th className="text-left p-4 text-muted-foreground font-medium">
                    Score
                  </th>
                  <th className="text-left p-4 text-muted-foreground font-medium">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((contractor, i) => (
                  <motion.tr
                    key={contractor.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.5) }}
                    className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <td className="p-4">
                      <div className="font-medium text-foreground">
                        {contractor.company}
                      </div>
                      {contractor.name &&
                        contractor.name !== contractor.company && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {contractor.name}
                          </div>
                        )}
                    </td>
                    <td className="p-4">
                      {contractor.email && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Envelope size={12} />
                          <a
                            href={`mailto:${contractor.email}`}
                            className="text-xs hover:text-primary"
                          >
                            {contractor.email}
                          </a>
                        </div>
                      )}
                      {contractor.phone && (
                        <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                          <Phone size={12} />
                          <span className="text-xs">{contractor.phone}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin size={12} />
                        {[contractor.city, contractor.state]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-xs text-muted-foreground">
                        {contractor.category}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-xs px-2 py-1 rounded-full border ${STATUS_COLORS[contractor.status] || STATUS_COLORS.new}`}
                      >
                        {contractor.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <Star
                          size={12}
                          className="text-yellow-400"
                          weight="fill"
                        />
                        <span className="text-xs font-medium">
                          {contractor.score}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-xs text-muted-foreground capitalize">
                        {(contractor.source || "shadow_scraper").replace(
                          /_/g,
                          " ",
                        )}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users size={40} className="mx-auto mb-3 opacity-50" />
                <p>No contractors found</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Cards View */}
      {!loading && view === "cards" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((contractor, i) => (
            <motion.div
              key={contractor.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.5) }}
            >
              <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm">
                        {contractor.company}
                      </CardTitle>
                      {contractor.name &&
                        contractor.name !== contractor.company && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <Buildings size={11} />
                            {contractor.name}
                          </div>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Star
                        size={12}
                        className="text-yellow-400"
                        weight="fill"
                      />
                      <span className="text-xs font-bold">
                        {contractor.score}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {contractor.email && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Envelope size={11} />
                      <a
                        href={`mailto:${contractor.email}`}
                        className="hover:text-primary truncate"
                      >
                        {contractor.email}
                      </a>
                    </div>
                  )}
                  {contractor.phone && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone size={11} />
                      {contractor.phone}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin size={11} />
                    {[contractor.city, contractor.state]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">
                      {contractor.category}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[contractor.status] || STATUS_COLORS.new}`}
                    >
                      {contractor.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-12 text-muted-foreground">
              <Users size={40} className="mx-auto mb-3 opacity-50" />
              <p>No contractors found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
