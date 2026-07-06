import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardContent, Input, Spinner } from "@/components";
import { useApiClient } from "@/lib/api";

export const Route = createFileRoute("/_layout/_authenticated/_superadmin/admin/platform/")({
  head: () => ({
    meta: [{ title: "Platform | Admin" }],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    prefillSlug: typeof search.prefillSlug === "string" ? search.prefillSlug : undefined,
    prefillDaoAccountId:
      typeof search.prefillDaoAccountId === "string" ? search.prefillDaoAccountId : undefined,
  }),
  component: PlatformPage,
});

type Member = {
  id: string;
  userId: string;
  nearAccountId: string | null;
  role: string;
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  contributor: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  client: "bg-green-500/10 text-green-600 border-green-500/20",
};

const LABEL_CLS = "font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground block";

function PlatformPage() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const { prefillSlug, prefillDaoAccountId } = useSearch({
    from: "/_layout/_authenticated/_superadmin/admin/platform/",
  });
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [confirmDeleteOrgId, setConfirmDeleteOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (prefillSlug || prefillDaoAccountId) setShowCreateOrg(true);
  }, [prefillSlug, prefillDaoAccountId]);

  const orgsQuery = useQuery({
    queryKey: ["platform", "orgs"],
    queryFn: () => apiClient.platform.listOrgs(),
  });

  const deleteOrgMutation = useMutation({
    mutationFn: (orgId: string) => apiClient.platform.deleteOrg({ orgId }),
    onSuccess: () => {
      toast.success("Organization deleted");
      queryClient.invalidateQueries({ queryKey: ["platform", "orgs"] });
      setConfirmDeleteOrgId(null);
      setEditingOrgId(null);
    },
    onError: (e: Error) => toast.error(e.message || "Failed to delete organization"),
  });

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          super admin · platform
        </div>
        <h2 className="font-display text-3xl sm:text-4xl font-black uppercase leading-none tracking-tight">
          Platform
        </h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Create and manage organizations. Assign initial org admins. Org-level member management
          lives under each org's own admin panel.
        </p>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
            organizations
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowCreateOrg((v) => !v)}>
            {showCreateOrg ? "cancel" : "+ new org"}
          </Button>
        </div>

        {showCreateOrg && (
          <OrgForm
            initialSlug={prefillSlug}
            initialDaoAccountId={prefillDaoAccountId}
            onDone={() => {
              queryClient.invalidateQueries({ queryKey: ["platform", "orgs"] });
              setShowCreateOrg(false);
            }}
          />
        )}

        {orgsQuery.isLoading && <Spinner />}

        {orgsQuery.data?.length === 0 && (
          <p className="font-mono text-sm text-muted-foreground">No organizations yet.</p>
        )}

        <div className="space-y-2">
          {orgsQuery.data?.map((org) => (
            <div key={org.id} className="space-y-0">
              <Card>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-0.5 min-w-0">
                    <div className="font-display text-base uppercase tracking-tight font-bold">
                      {org.name}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">@{org.slug}</div>
                    {(org.metadata as any)?.daoAccountId && (
                      <div className="font-mono text-[10px] text-muted-foreground break-all">
                        dao: {String((org.metadata as any).daoAccountId)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingOrgId(editingOrgId === org.id ? null : org.id)}
                    >
                      {editingOrgId === org.id ? "cancel" : "edit"}
                    </Button>
                    {confirmDeleteOrgId === org.id ? (
                      <>
                        <span className="font-mono text-[11px] text-destructive">sure?</span>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteOrgMutation.mutate(org.id)}
                          disabled={deleteOrgMutation.isPending}
                        >
                          {deleteOrgMutation.isPending ? "…" : "yes, delete"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDeleteOrgId(null)}
                          disabled={deleteOrgMutation.isPending}
                        >
                          cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setConfirmDeleteOrgId(org.id)}
                      >
                        delete
                      </Button>
                    )}
                    <a
                      href={`http://${org.slug}.localhost:3000/admin/settings`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Button size="sm" variant="outline">
                        open →
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
              {editingOrgId === org.id && (
                <OrgForm
                  org={{ ...org, slug: org.slug ?? "" }}
                  onDone={() => {
                    queryClient.invalidateQueries({ queryKey: ["platform", "orgs"] });
                    setEditingOrgId(null);
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function OrgForm({
  org,
  onDone,
  initialSlug,
  initialDaoAccountId,
}: {
  org?: { id: string; name: string; slug: string; metadata: Record<string, unknown> | null };
  onDone: () => void;
  initialSlug?: string;
  initialDaoAccountId?: string;
}) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const isEdit = !!org;

  const [name, setName] = useState(org?.name ?? "");
  const [slug, setSlug] = useState(org?.slug ?? initialSlug ?? "");
  const [type, setType] = useState<"agency" | "client">(
    ((org?.metadata as any)?.type as "agency" | "client") ?? "client",
  );
  const [daoAccountId, setDaoAccountId] = useState(
    String((org?.metadata as any)?.daoAccountId ?? initialDaoAccountId ?? ""),
  );
  const [adminNearId, setAdminNearId] = useState("");

  const membersQuery = useQuery({
    queryKey: ["platform", "orgs", org?.id, "members"],
    queryFn: () => apiClient.platform.listOrgMembers({ orgId: org!.id }),
    enabled: isEdit,
  });

  const slugFromName = (n: string) =>
    n
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

  const mutation = useMutation({
    mutationFn: () =>
      isEdit
        ? apiClient.platform.updateOrg({
            orgId: org.id,
            name: name.trim() || undefined,
            daoAccountId: daoAccountId.trim() || undefined,
            type: type || undefined,
          })
        : apiClient.platform.createOrg({
            name: name.trim(),
            slug: slug.trim(),
            type,
            daoAccountId: daoAccountId.trim(),
            ...(adminNearId.trim() ? { adminNearId: adminNearId.trim() } : {}),
          }),
    onSuccess: (result) => {
      toast.success(
        isEdit ? "Organization updated" : `Organization "${(result as any).name}" created`,
      );
      onDone();
    },
    onError: (e: Error) =>
      toast.error(e.message || (isEdit ? "Failed to update" : "Failed to create")),
  });

  const canSubmit =
    name.trim().length > 0 &&
    (isEdit || (slug.trim().length > 0 && daoAccountId.trim().length > 0)) &&
    !mutation.isPending;

  return (
    <Card className={isEdit ? "rounded-t-none border-t-0" : ""}>
      <CardContent className="p-5 space-y-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {isEdit ? "edit organization" : "create organization"}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="org-name" className={LABEL_CLS}>
              name
            </label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!isEdit && (!slug || slug === slugFromName(name)))
                  setSlug(slugFromName(e.target.value));
              }}
              placeholder="Acme Agency"
              disabled={mutation.isPending}
            />
          </div>
          {!isEdit && (
            <div className="space-y-1">
              <label htmlFor="org-slug" className={LABEL_CLS}>
                slug
              </label>
              <Input
                id="org-slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="acme-agency"
                disabled={mutation.isPending}
              />
            </div>
          )}
          <div className="space-y-1">
            <label htmlFor="org-type" className={LABEL_CLS}>
              type
            </label>
            <select
              id="org-type"
              value={type}
              onChange={(e) => setType(e.target.value as "agency" | "client")}
              disabled={mutation.isPending}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 font-mono text-xs"
            >
              <option value="client">client</option>
              <option value="agency">agency</option>
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="org-dao-account" className={LABEL_CLS}>
              sputnik dao account
            </label>
            <Input
              id="org-dao-account"
              value={daoAccountId}
              onChange={(e) => setDaoAccountId(e.target.value)}
              placeholder="acme.sputnik-dao.near"
              disabled={mutation.isPending}
            />
          </div>
          {!isEdit && (
            <div className="space-y-1">
              <label htmlFor="org-admin-near-id" className={LABEL_CLS}>
                admin near id (optional)
              </label>
              <Input
                id="org-admin-near-id"
                value={adminNearId}
                onChange={(e) => setAdminNearId(e.target.value)}
                placeholder="alice.near"
                disabled={mutation.isPending}
              />
            </div>
          )}
        </div>

        <Button
          onClick={() => mutation.mutate()}
          disabled={!canSubmit}
          className="font-display uppercase tracking-wide"
        >
          {mutation.isPending
            ? isEdit
              ? "saving…"
              : "creating…"
            : isEdit
              ? "save changes →"
              : "create org →"}
        </Button>

        {isEdit && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              members
            </div>
            <AddMemberForm
              orgId={org.id}
              onAdded={() =>
                queryClient.invalidateQueries({ queryKey: ["platform", "orgs", org.id, "members"] })
              }
            />
            {membersQuery.isLoading && <Spinner />}
            {membersQuery.data?.length === 0 && (
              <p className="font-mono text-sm text-muted-foreground">No members yet.</p>
            )}
            <div className="space-y-2">
              {membersQuery.data?.map((member) => (
                <MemberRow
                  key={member.id}
                  member={member}
                  orgId={org.id}
                  onChanged={() =>
                    queryClient.invalidateQueries({
                      queryKey: ["platform", "orgs", org.id, "members"],
                    })
                  }
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AddMemberForm({ orgId, onAdded }: { orgId: string; onAdded: () => void }) {
  const apiClient = useApiClient();
  const [nearAccountId, setNearAccountId] = useState("");
  const [role, setRole] = useState<"admin" | "contributor" | "client">("contributor");

  const addMutation = useMutation({
    mutationFn: () =>
      apiClient.platform.addOrgMember({ orgId, nearAccountId: nearAccountId.trim(), role }),
    onSuccess: () => {
      toast.success(`Added ${nearAccountId}`);
      setNearAccountId("");
      onAdded();
    },
    onError: (e: Error) => toast.error(e.message || "Failed to add member"),
  });

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 space-y-1">
        <label htmlFor="add-org-member-near-id" className={LABEL_CLS}>
          near account id
        </label>
        <Input
          id="add-org-member-near-id"
          value={nearAccountId}
          onChange={(e) => setNearAccountId(e.target.value)}
          placeholder="alice.near"
          disabled={addMutation.isPending}
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="add-org-member-role" className={LABEL_CLS}>
          role
        </label>
        <select
          id="add-org-member-role"
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          disabled={addMutation.isPending}
          className="h-9 rounded-md border border-input bg-background px-3 py-1 font-mono text-xs"
        >
          <option value="admin">admin</option>
          <option value="contributor">contributor</option>
          <option value="client">client</option>
        </select>
      </div>
      <Button
        size="sm"
        onClick={() => addMutation.mutate()}
        disabled={!nearAccountId.trim() || addMutation.isPending}
      >
        {addMutation.isPending ? "adding…" : "add →"}
      </Button>
    </div>
  );
}

export function MemberRow({
  member,
  orgId,
  onChanged,
  isPlatform = true,
}: {
  member: Member;
  orgId: string;
  onChanged: () => void;
  isPlatform?: boolean;
}) {
  const apiClient = useApiClient();
  const [pendingRole, setPendingRole] = useState<"admin" | "contributor" | "client">(
    member.role as "admin" | "contributor" | "client",
  );
  const isDirty = pendingRole !== member.role;

  const updateMutation = useMutation({
    mutationFn: () =>
      isPlatform
        ? apiClient.platform.updateOrgMember({ orgId, memberId: member.id, role: pendingRole })
        : apiClient.members.updateRole({ memberId: member.id, role: pendingRole }),
    onSuccess: () => {
      toast.success("Role updated");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message || "Failed to update role"),
  });

  const removeMutation = useMutation({
    mutationFn: () =>
      isPlatform
        ? apiClient.platform.removeOrgMember({ orgId, memberId: member.id })
        : apiClient.members.remove({ memberId: member.id }),
    onSuccess: () => {
      toast.success("Member removed");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message || "Failed to remove member"),
  });

  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm truncate">{member.nearAccountId ?? member.userId}</div>
        </div>
        <span
          className={`font-mono text-[10px] uppercase px-2 py-0.5 rounded-sm border ${ROLE_COLORS[member.role] ?? ""}`}
        >
          {member.role}
        </span>
        <select
          value={pendingRole}
          onChange={(e) => setPendingRole(e.target.value as typeof pendingRole)}
          disabled={updateMutation.isPending || removeMutation.isPending}
          className="h-7 rounded border border-input bg-background px-2 font-mono text-[11px]"
        >
          <option value="admin">admin</option>
          <option value="contributor">contributor</option>
          <option value="client">client</option>
        </select>
        {isDirty && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? "…" : "save"}
          </Button>
        )}
        <Button
          size="sm"
          variant="destructive"
          onClick={() => removeMutation.mutate()}
          disabled={removeMutation.isPending || updateMutation.isPending}
        >
          {removeMutation.isPending ? "…" : "remove"}
        </Button>
      </CardContent>
    </Card>
  );
}
