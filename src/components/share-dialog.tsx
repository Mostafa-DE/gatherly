import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Share2,
  Copy,
  Check,
  QrCode,
  ExternalLink,
  LinkIcon,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { copyToClipboard } from "@/lib/clipboard";
import { buildWhatsAppUrl, buildInviteUrl } from "@/lib/share-urls";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";

type ShareDialogProps = {
  url: string;
  title?: string;
  type?: "group" | "session";
  groupName?: string;
  username?: string;
  inviteLink?: {
    orgId: string;
    username: string;
    groupSlug: string;
  };
};

export function ShareDialog({
  url,
  title,
  type = "group",
  groupName,
  username,
  inviteLink,
}: ShareDialogProps) {
  const isMobile = useIsMobile();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard(url, "Link");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsApp = () => {
    let message: string | undefined;
    if (type === "session" && title && groupName) {
      message = `Hey! Join us for *${title}* with *${groupName}* (@${
        username ?? groupName
      }) on Gatherly`;
    } else if (type === "group" && title) {
      message = `Hey! Join *${title}* (@${username ?? title}) on Gatherly`;
    }
    window.open(buildWhatsAppUrl(url, message), "_blank");
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({
        title: title ?? "Check this out",
        url,
      });
    } catch {
      // User cancelled or not supported
    }
  };

  const supportsNativeShare =
    typeof navigator !== "undefined" && !!navigator.share;
  const actionButtonSize = isMobile ? "default" : "sm";

  const content = (
    <div className="space-y-4">
      {/* URL display */}
      <div className="rounded-md border bg-muted/50 p-3 text-sm">
        <div className="mb-2 flex items-center gap-2 text-muted-foreground">
          <LinkIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs font-medium uppercase tracking-wide">
            Link
          </span>
        </div>
        <div className="w-full overflow-hidden rounded border bg-background/80">
          <code className="block break-all px-2 py-1 text-muted-foreground">
            {url}
          </code>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button
          variant="outline"
          size={actionButtonSize}
          className="w-full min-w-0 justify-start overflow-hidden whitespace-normal"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="mr-2 h-4 w-4 text-green-500" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          <span className="truncate">{copied ? "Copied!" : "Copy Link"}</span>
        </Button>

        <Button
          variant="outline"
          size={actionButtonSize}
          className="w-full min-w-0 justify-start overflow-hidden whitespace-normal"
          onClick={handleWhatsApp}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          <span className="truncate">WhatsApp</span>
        </Button>

        {supportsNativeShare && (
          <Button
            variant="outline"
            size={actionButtonSize}
            className="w-full min-w-0 justify-start overflow-hidden whitespace-normal"
            onClick={handleNativeShare}
          >
            <Share2 className="mr-2 h-4 w-4" />
            <span className="truncate">More...</span>
          </Button>
        )}

        <Button
          variant="outline"
          size={actionButtonSize}
          className="w-full min-w-0 justify-start overflow-hidden whitespace-normal"
          onClick={() => setShowQr((prev) => !prev)}
        >
          <QrCode className="mr-2 h-4 w-4" />
          <span className="truncate">{showQr ? "Hide QR" : "QR Code"}</span>
        </Button>
      </div>

      {/* QR Code */}
      {showQr && (
        <div className="flex justify-center rounded-md border bg-white p-4">
          <QRCodeSVG value={url} size={180} />
        </div>
      )}

      {/* Invite Link (admin only) */}
      {inviteLink && (
        <InviteLinkSection
          username={inviteLink.username}
          groupSlug={inviteLink.groupSlug}
        />
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm">
            <Share2 className="mr-2 h-4 w-4" />
            Share
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[85vh] p-0">
          <SheetHeader className="border-b px-4 py-3 text-left">
            <SheetTitle>Share</SheetTitle>
            <SheetDescription>Copy link or share quickly.</SheetDescription>
          </SheetHeader>
          <div className="h-[calc(85vh-5.5rem)] overflow-y-auto px-4 py-4">
            {content}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="mr-2 h-4 w-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}

const EXPIRY_OPTIONS = [
  { value: "1", label: "24 hours" },
  { value: "3", label: "3 days" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
] as const;

function InviteLinkSection({
  username,
  groupSlug,
}: {
  username: string;
  groupSlug: string;
}) {
  const [expiryDays, setExpiryDays] = useState("7");

  const createInviteLink = trpc.inviteLink.create.useMutation({
    onSuccess: (data) => {
      const inviteUrl = buildInviteUrl(username, groupSlug, data.token);
      copyToClipboard(inviteUrl, "Invite link");
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleGenerate = () => {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + Number(expiryDays));
    createInviteLink.mutate({ role: "member", expiresAt, maxUses: 1 });
  };

  return (
    <div className="border-t pt-4 space-y-3">
      <h4 className="text-sm font-medium">Invite Link</h4>

      <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/5 p-2.5 text-xs text-yellow-600 dark:text-yellow-400">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          Anyone with this link can join your group directly, bypassing join
          restrictions. Each link can only be used once.
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground shrink-0">
          Expires in
        </span>
        <Select value={expiryDays} onValueChange={setExpiryDays}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXPIRY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button
        variant="default"
        size="sm"
        className="w-full"
        onClick={handleGenerate}
        disabled={createInviteLink.isPending}
      >
        <LinkIcon className="mr-2 h-4 w-4" />
        {createInviteLink.isPending ? "Generating..." : "Generate Invite Link"}
      </Button>
    </div>
  );
}
