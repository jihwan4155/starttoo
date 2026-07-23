import CtaButton from "../ui/CtaButton";

type DualImageFeatureSectionProps = {
	id?: string;
	eyebrow: string;
	heading: string;
	description: string;
	buttonLabel: string;
	buttonTo: string;
	imageBefore: string;
	imageAfter: string;
	imageAlt: string;
};

export default function DualImageFeatureSection({
	id,
	eyebrow,
	heading,
	description,
	buttonLabel,
	buttonTo,
	imageBefore,
	imageAfter,
	imageAlt,
}: DualImageFeatureSectionProps) {
	return (
		<section
			id={id}
			className="mx-auto flex w-full max-w-[1199px] flex-col items-center py-24">
			<p className="text-[24px] font-normal leading-7 text-black">
				{eyebrow}
			</p>
			<h2 className="mt-3 text-center text-[48px] font-extrabold leading-[57px] text-black">
				{heading}
			</h2>
			<p className="mt-4 max-w-[688px] text-center text-[18px] font-light leading-[21px] text-black">
				{description}
			</p>

			<div className="mt-6 flex items-center justify-center gap-8">
				<img
					src={imageBefore}
					alt={`${imageAlt} - Before`}
					className="h-[284px] w-[380px] shrink-0 rounded-[10px] object-cover"
				/>
				<img
					src={imageAfter}
					alt={`${imageAlt} - After`}
					className="h-[284px] w-[380px] shrink-0 rounded-[10px] object-cover"
				/>
			</div>

			<CtaButton to={buttonTo} className="mt-10">
				{buttonLabel}
			</CtaButton>
		</section>
	);
}
