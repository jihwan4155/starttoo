import CtaButton from "../ui/CtaButton";
import demoImage from "../../assets/images/demo-tattoo.png";

type FeatureBlockProps = {
	id?: string;
	reversed?: boolean;
	eyebrow: string;
	heading: [string, string];
	description: string;
	buttonLabel: string;
	buttonTo: string;
};

function FeatureCopy({
	eyebrow,
	heading,
	description,
	buttonLabel,
	buttonTo,
}: Omit<FeatureBlockProps, "id" | "reversed">) {
	return (
		<div className="flex w-full max-w-[482px] flex-col">
			<p className="text-[24px] font-normal leading-7 text-black">
				{eyebrow}
			</p>
			<h2 className="mt-5 text-[48px] font-extrabold leading-[57px] text-black">
				{heading[0]}
				<br />
				{heading[1]}
			</h2>
			<p className="mt-5 text-[18px] font-light leading-[21px] text-black">
				{description}
			</p>
			<CtaButton to={buttonTo} className="mt-8">
				{buttonLabel}
			</CtaButton>
		</div>
	);
}

function FeatureImage() {
	return (
		<img
			src={demoImage}
			alt="타투 도안 예시"
			className="h-[334px] w-full max-w-[493px] rounded-[10px] object-cover"
		/>
	);
}

export default function FeatureSection({
	id,
	reversed = false,
	eyebrow,
	heading,
	description,
	buttonLabel,
	buttonTo,
}: FeatureBlockProps) {
	return (
		<section
			id={id}
			className="mx-auto flex w-full max-w-[1199px] items-center justify-center py-[138px]">
			<div
				className={`flex w-full max-w-[1039px] items-center justify-between gap-10 ${
					reversed ? "flex-row-reverse" : "flex-row"
				}`}>
				<FeatureCopy
					eyebrow={eyebrow}
					heading={heading}
					description={description}
					buttonLabel={buttonLabel}
					buttonTo={buttonTo}
				/>
				<FeatureImage />
			</div>
		</section>
	);
}
