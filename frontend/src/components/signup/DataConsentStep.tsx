import { useState } from "react";
import { Link } from "react-router-dom";
import { PRIVACY_POLICY } from "../../constants/legal";

type DataConsentStepProps = {
	/** 두 항목 모두 필수라, 전부 체크됐을 때만 불린다 */
	onAgree: () => void;
	disabled?: boolean;
};

/** 동의 항목 한 줄에 딸린 상세 설명 */
const SERVICE_DETAILS = [
	"입력한 프롬프트·스타일 선택값과 생성된 도안을 결과 제공과 보관에 사용합니다.",
	"시뮬레이션을 위해 올린 신체 사진은 결과 생성 직후 삭제합니다.",
	"저장·좋아요 기록은 회원님에게 도안을 추천하는 데 사용합니다.",
];

const AI_TRAINING_DETAILS = [
	"공개로 올린 도안과 프롬프트·반응 기록을 도안 생성·추천 모델 학습에 활용합니다.",
	"학습 전 닉네임·연락처 등 회원을 알아볼 수 있는 정보를 분리합니다.",
	"비공개 도안, 다이렉트 메시지, 신체 사진은 학습에 쓰지 않습니다.",
];

/**
 * 역할 선택 직전에 받는 데이터 처리 동의.
 *
 * 서비스가 회원의 도안·프롬프트를 다루고 그것으로 AI 품질을 개선하기 때문에
 * 가입을 마치기 전에 무엇을 어디까지 쓰는지 알리고 동의를 받는다.
 *
\

* 확인만 하고 서버로 보내지 않는다 — 동의 없이는 가입 자체가 진행되지 않으므로
 * 가입 기록이 곧 동의 기록이다.
 */
export default function DataConsentStep({
	onAgree,
	disabled,
}: DataConsentStepProps) {
	const [service, setService] = useState(false);
	const [aiTraining, setAiTraining] = useState(false);

	const allChecked = service && aiTraining;

	const toggleAll = () => {
		const next = !allChecked;
		setService(next);
		setAiTraining(next);
	};

	return (
		<div>
			<p className="mb-4 text-center text-[13px] font-light leading-5 text-black/50">
				스타투는 회원님이 만든 도안으로 추천과 AI 품질을 개선합니다.
				<br />
				어떤 데이터를 어떻게 쓰는지 먼저 확인해 주세요.
			</p>

			<button
				type="button"
				onClick={toggleAll}
				aria-pressed={allChecked}
				className={`flex w-full items-center gap-3 rounded-[10px] border px-4 py-3 text-left transition ${
					allChecked
						? "border-brand bg-brand/5"
						: "border-black/15 bg-white hover:bg-black/[0.02]"
				}`}>
				<CheckMark checked={allChecked} />
				<span className="text-[15px] font-semibold text-black">전체 동의</span>
			</button>

			<div className="mt-3 space-y-2">
				<ConsentItem
					label="[필수] 서비스 제공을 위한 데이터 처리"
					checked={service}
					onToggle={() => setService((prev) => !prev)}
					details={SERVICE_DETAILS}
				/>
				<ConsentItem
					label="[필수] AI 모델 학습 활용"
					checked={aiTraining}
					onToggle={() => setAiTraining((prev) => !prev)}
					details={AI_TRAINING_DETAILS}
				/>
			</div>

			<p className="mt-3 text-[12px] font-light leading-5 text-black/45">
				자세한 내용은{" "}
				{/* 가입 도중이라 같은 탭에서 나가면 흐름이 끊긴다 — 새 탭으로 연다 */}
				<Link
					to={PRIVACY_POLICY.path}
					target="_blank"
					rel="noreferrer"
					className="font-normal text-brand underline underline-offset-2">
					{PRIVACY_POLICY.title}
				</Link>
				에서 확인할 수 있어요.
			</p>

			<button
				type="button"
				disabled={disabled || !allChecked}
				onClick={onAgree}
				className="mt-5 h-[52px] w-full rounded-[10px] bg-brand text-[16px] font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:bg-[#FFB4B4]">
				동의하고 계속하기
			</button>
		</div>
	);
}

function ConsentItem({
	label,
	checked,
	onToggle,
	details,
}: {
	label: string;
	checked: boolean;
	onToggle: () => void;
	details: string[];
}) {
	return (
		<div className="rounded-[10px] border border-black/10 bg-white px-4 py-3">
			<button
				type="button"
				onClick={onToggle}
				aria-pressed={checked}
				className="flex w-full items-center gap-3 text-left">
				<CheckMark checked={checked} />
				<span className="text-[14px] font-normal text-black">{label}</span>
			</button>
			<ul className="mt-2 space-y-1 pl-[34px]">
				{details.map((detail) => (
					<li
						key={detail}
						className="relative pl-3 text-[12px] font-light leading-5 text-black/50">
						<span
							aria-hidden
							className="absolute left-0 top-[8px] h-[3px] w-[3px] rounded-full bg-black/30"
						/>
						{detail}
					</li>
				))}
			</ul>
		</div>
	);
}

function CheckMark({ checked }: { checked: boolean }) {
	return (
		<span
			aria-hidden
			className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full transition ${
				checked ? "bg-brand text-white" : "bg-black/10 text-white"
			}`}>
			<svg
				width="12"
				height="12"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				strokeWidth="3"
				strokeLinecap="round"
				strokeLinejoin="round">
				<path d="M5 13l4 4L19 7" />
			</svg>
		</span>
	);
}
