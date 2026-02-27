"use client";

import { useEffect, useState } from "react";
import Card from "@/components/Card";
import LibraryReader from "@/components/LibraryReader";
import { SUBJECT_LABELS } from "@/lib/constants";

export default function SharedLibraryPage({ params }: { params: { token: string } }) {
  const [item, setItem] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/library/shared/${params.token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.error) {
          setError(data.error);
        } else {
          setItem(data?.data ?? null);
        }
      });
  }, [params.token]);

  if (error) {
    return <Card title="分享阅读">{error}</Card>;
  }
  if (!item) {
    return <Card title="分享阅读">加载中...</Card>;
  }

  return (
    <div className="grid" style={{ gap: 18 }}>
      <div className="section-head">
        <div>
          <h2>{item.title}</h2>
          <div className="section-sub">
            {SUBJECT_LABELS[item.subject] ?? item.subject} · {item.grade} 年级
          </div>
        </div>
        <span className="chip">分享</span>
      </div>

      <Card title="内容" tag="只读">
        <LibraryReader item={item} />
      </Card>
    </div>
  );
}
