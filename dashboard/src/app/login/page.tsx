"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ParkingCircle, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAppStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        return;
      }

      if (data.user) {
        setUser({
          id: data.user.id,
          email: data.user.email ?? "",
          name: data.user.user_metadata?.name ?? data.user.email ?? "",
          role: data.user.user_metadata?.role ?? "admin",
          locations: data.user.user_metadata?.locations ?? [],
        });
        router.push("/overview");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-base flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <ParkingCircle className="h-12 w-12 text-amber mb-4" />
          <h1 className="text-2xl font-semibold text-text-primary">
            Welcome back
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Sign in to your SupaPark dashboard
          </p>
        </div>

        <Card className="bg-surface-raised border-border">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-error/10 border border-error/20 px-3 py-2.5 text-sm text-error">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-secondary">
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@supapark.id"
                  required
                  autoComplete="email"
                  className="bg-surface-overlay border-border"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-text-secondary">
                  Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    autoComplete="current-password"
                    className="pr-10 bg-surface-overlay border-border"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-amber hover:bg-amber-500 text-surface-base font-semibold"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-text-tertiary mt-6">
          SupaPark Smart Parking System
        </p>
      </div>
    </div>
  );
}
