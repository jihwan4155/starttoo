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
			className="mx-auto flex w-full max-w-[1199px] flex-col items-center px-5 py-13 lg:px-0 lg:py-24">
			<p className="text-center text-[16px] font-normal leading-6 text-black lg:text-[24px] lg:leading-7">
				{eyebrow}
			</p>
			<h2 className="mt-2.5 text-center text-[27px] font-extrabold leading-[34px] tracking-[-0.04em] text-black lg:mt-3 lg:text-[48px] lg:leading-[57px]">
				{heading}
			</h2>
			<p className="mt-4 max-w-[688px] text-center text-[15px] font-light leading-6 text-black/70 lg:text-[18px] lg:leading-[21px] lg:text-black">
				{description}
			</p>

			<div className="mt-7 grid w-full grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-6 lg:flex lg:w-auto lg:items-center lg:justify-center lg:gap-8">
				<img
					src={imageBefore}
					alt={`${imageAlt} - Before`}
					className="aspect-[1.34/1] h-auto w-full shrink-0 rounded-[10px] object-cover lg:h-[284px] lg:w-[380px]"
				/>
				<img
					src={imageAfter}
					alt={`${imageAlt} - After`}
					className="aspect-[1.34/1] h-auto w-full shrink-0 rounded-[10px] object-cover lg:h-[284px] lg:w-[380px]"
				/>
			</div>

			<CtaButton to={buttonTo} className="mt-7 lg:mt-10">
				{buttonLabel}
			</CtaButton>
		</section>
	);
}
