import React, { useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useGetUser, getGetUserQueryKey, useUpdateUser } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { UserCircle, Upload, Save, KeyRound, ImageIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const ku: React.CSSProperties = { fontFamily: "'Noto Kufi Arabic', sans-serif" };

const profileSchema = z.object({
  full_name: z.string().min(1, "ناوی تەواو پێویستە").max(150),
  email: z.string().email("ئیمەیڵ هەڵەیە"),
});

const passwordSchema = z.object({
  password: z.string().min(6, "ووشەی نهێنی دەبێت کەمتر نەبێت لە ٦ پیت"),
  password_confirmation: z.string().min(1, "دووبارەکردنەوەی ووشەی نهێنی پێویستە"),
}).refine((d) => d.password === d.password_confirmation, {
  message: "ووشەکانی نهێنی وەک یەک نین",
  path: ["password_confirmation"],
});

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

function getSignatureUrl(filename: string | null | undefined): string | null {
  if (!filename) return null;
  const origin = window.location.origin;
  return `${origin}/api/users/uploads/signatures/${filename}`;
}

export default function Profile() {
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sigUploading, setSigUploading] = useState(false);
  const [sigPreview, setSigPreview] = useState<string | null>(null);

  const { data: user, isLoading } = useGetUser(authUser!.id, {
    query: { queryKey: getGetUserQueryKey(authUser!.id) },
  });

  // ── Profile form ──────────────────────────────────────────────
  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: user ? { full_name: user.full_name, email: user.email } : { full_name: "", email: "" },
  });

  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        toast({ title: "پڕۆفایل نوێکرایەوە." });
        queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(authUser!.id) });
      },
      onError: (e: any) => toast({ title: "هەڵە", description: e.message, variant: "destructive" }),
    },
  });

  const onProfileSubmit = (values: ProfileValues) => {
    updateMutation.mutate({ id: authUser!.id, data: values });
  };

  // ── Password form ─────────────────────────────────────────────
  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", password_confirmation: "" },
  });

  const passwordMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        toast({ title: "ووشەی نهێنی گۆڕدرا." });
        passwordForm.reset();
      },
      onError: (e: any) => toast({ title: "هەڵە", description: e.message, variant: "destructive" }),
    },
  });

  const onPasswordSubmit = (values: PasswordValues) => {
    passwordMutation.mutate({ id: authUser!.id, data: { password: values.password } });
  };

  // ── Signature upload ──────────────────────────────────────────
  const handleSignatureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "image/png") {
      toast({ title: "هەڵە", description: "تەنها فایلی PNG قبوڵدەکرێت.", variant: "destructive" });
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast({ title: "هەڵە", description: "فایل دەبێت کەمتر بێت لە ١ MB.", variant: "destructive" });
      return;
    }

    setSigPreview(URL.createObjectURL(file));
    setSigUploading(true);

    try {
      const formData = new FormData();
      formData.append("signature", file);
      const origin = window.location.origin;
      const res = await fetch(`${origin}/api/users/${authUser!.id}/signature`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      toast({ title: "ئیمزا بارکرا." });
      queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(authUser!.id) });
    } catch (err: any) {
      toast({ title: "هەڵە", description: err.message, variant: "destructive" });
      setSigPreview(null);
    } finally {
      setSigUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const currentSig = sigPreview ?? getSignatureUrl(user?.signature_image);

  return (
    <div className="space-y-6 max-w-2xl" style={ku}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-blue-600/10 p-2">
          <UserCircle className="h-8 w-8 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">پڕۆفایلی من</h1>
          <p className="text-muted-foreground mt-0.5">دەستکاریکردنی زانیاری کەسی و ئیمزات</p>
        </div>
      </div>

      {/* Profile info card */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">زانیاری کەسی</CardTitle>
          <CardDescription>ناو و ئیمەیڵی خۆت بگۆڕە.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
              <FormField
                control={profileForm.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={ku}>ناوی تەواو</FormLabel>
                    <FormControl>
                      <Input {...field} className="text-right" style={ku} />
                    </FormControl>
                    <FormMessage style={ku} />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={ku}>ئیمەیڵ</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" dir="ltr" className="text-left" />
                    </FormControl>
                    <FormMessage style={ku} />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={updateMutation.isPending} style={ku}>
                  <Save className="h-4 w-4 ml-2" />
                  {updateMutation.isPending ? "چاوەڕێ بکە..." : "پاشەکەوتکردن"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Password card */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-muted-foreground" />
            گۆڕینی ووشەی نهێنی
          </CardTitle>
          <CardDescription>ووشەی نهێنی نوێ بنووسە.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
              <FormField
                control={passwordForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={ku}>ووشەی نهێنی نوێ</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" dir="ltr" className="text-left" />
                    </FormControl>
                    <FormMessage style={ku} />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="password_confirmation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={ku}>دووبارەکردنەوەی ووشەی نهێنی</FormLabel>
                    <FormControl>
                      <Input {...field} type="password" dir="ltr" className="text-left" />
                    </FormControl>
                    <FormMessage style={ku} />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={passwordMutation.isPending} style={ku}>
                  <KeyRound className="h-4 w-4 ml-2" />
                  {passwordMutation.isPending ? "چاوەڕێ بکە..." : "گۆڕینی ووشەی نهێنی"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Signature card */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
            ئیمزای وێنە
          </CardTitle>
          <CardDescription>ئیمزای PNG بارکە (زیاترە نەبێت لە ١ MB).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current signature preview */}
          <div className="rounded-lg border border-dashed border-border bg-muted/30 flex items-center justify-center p-4 min-h-[100px]">
            {currentSig ? (
              <img
                src={currentSig}
                alt="ئیمزا"
                className="max-h-24 object-contain"
                style={{ background: "transparent" }}
              />
            ) : (
              <p className="text-sm text-muted-foreground" style={ku}>هیچ ئیمزایەک بارنەکراوە.</p>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png"
            className="hidden"
            onChange={handleSignatureChange}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={sigUploading}
            style={ku}
          >
            <Upload className="h-4 w-4 ml-2" />
            {sigUploading ? "بارکردن..." : "هەڵبژاردنی فایلی PNG"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
