"use client";

import { useCallback, useState, type FormEvent } from "react";
import { requestJson } from "@/lib/client-request";

type RegisterFields = Record<string, string>;

type ManagedRedirectRegisterFormConfig<TFields extends RegisterFields, TPayload> = {
  initialValues: TFields;
  endpoint: string;
  redirectTo: string;
  buildPayload: (values: TFields) => TPayload;
  resolveError: (error: unknown) => string;
};

export function useManagedRedirectRegisterForm<TFields extends RegisterFields, TPayload>({
  initialValues,
  endpoint,
  redirectTo,
  buildPayload,
  resolveError
}: ManagedRedirectRegisterFormConfig<TFields, TPayload>) {
  const [values, setValues] = useState<TFields>(initialValues);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setValue = useCallback(<K extends keyof TFields>(field: K, value: TFields[K]) => {
    setValues((current) => ({ ...current, [field]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setLoading(true);
      setError(null);

      try {
        await requestJson(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload(values))
        });
        window.location.assign(redirectTo);
      } catch (nextError) {
        setError(resolveError(nextError));
      } finally {
        setLoading(false);
      }
    },
    [buildPayload, endpoint, redirectTo, resolveError, values]
  );

  return {
    values,
    error,
    loading,
    setValue,
    handleSubmit
  };
}
