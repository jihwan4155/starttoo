import { useState } from "react";
import Simulation3DStep from "../../../frontend/src/components/simulation/Simulation3DStep";
import { useBodyScan } from "../../../frontend/src/components/simulation/useBodyScan";

function useObjectUrl() {
  const [url, setUrl] = useState<string | null>(null);
  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return URL.createObjectURL(file);
    });
  };
  return [url, onChange] as const;
}

export default function App() {
  const [photoUrl, onPhotoChange] = useObjectUrl();
  const [designUrl, onDesignChange] = useObjectUrl();
  const scan = useBodyScan(photoUrl, Boolean(photoUrl));

  return (
    <div style={{ minHeight: "100vh", padding: 24 }}>
      <div className="mx-auto mb-4 flex max-w-[900px] flex-wrap items-center gap-6 rounded-[12px] bg-white p-4 text-[13px] shadow-sm">
        <label className="flex flex-col gap-1 font-semibold">
          ① 신체 사진
          <input type="file" accept="image/*" onChange={onPhotoChange} />
        </label>
        <label className="flex flex-col gap-1 font-semibold">
          ② 타투 도안
          <input type="file" accept="image/*" onChange={onDesignChange} />
        </label>
        <span className="text-black/40">
          실제 Simulation3DStep.tsx를 그대로 불러온 미리보기입니다 (dev 코드 수정 없음).
        </span>
      </div>

      <div className="mx-auto flex h-[720px] max-w-[900px] flex-col items-center gap-4 rounded-[16px] bg-white p-6 shadow-sm">
        <p className="text-center text-[15px] font-semibold text-black">
          타투를 배치하고 완성된 결과를 확인하세요
        </p>
        <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-3">
          <Simulation3DStep designUrl={designUrl} scan={scan} onSaved={() => {}} />
        </div>
      </div>
    </div>
  );
}
