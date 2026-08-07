import CtaButton from "../ui/CtaButton";

type FeatureBlockProps = {
	id?: string;
	reversed?: boolean;
	eyebrow: string;
	heading: [string, string];
	description: string;
	buttonLabel: string;
	buttonTo: string;
	image: string;
	imageAlt: string;
};

function FeatureCopy({
	eyebrow,
	heading,
	description,
	buttonLabel,
	buttonTo,
}: Omit<FeatureBlockProps, "id" | "reversed" | "image" | "imageAlt">) {
	return (
		<div className="home-feature-copy flex w-full max-w-[650px] flex-col items-center lg:w-fit lg:items-start">
			<p className="w-full text-[16px] font-normal leading-6 text-black lg:w-auto lg:whitespace-nowrap lg:text-[24px] lg:leading-7">
				{eyebrow}
			</p>
			<h2 className="mt-2.5 w-full text-[27px] font-extrabold leading-[34px] tracking-[-0.04em] text-black lg:mt-5 lg:w-auto lg:whitespace-nowrap lg:text-[48px] lg:leading-[57px]">
				{heading[0]}
				<br />
				{heading[1]}
			</h2>
			<p className="mt-4 w-full text-[15px] font-light leading-6 text-black/70 lg:mt-5 lg:w-auto lg:text-[18px] lg:leading-[21px] lg:text-black">
				{description}
			</p>
			<div className="mt-8 hidden lg:block">
				<CtaButton to={buttonTo}>{buttonLabel}</CtaButton>
			</div>
		</div>
	);
}

function FeatureImage({ image, imageAlt }: { image: string; imageAlt: string }) {
	return (
		<img
			src={image}
			alt={imageAlt}
			className="aspect-[1.48/1] h-auto w-full shrink-0 rounded-[10px] object-cover lg:h-[284px] lg:w-[420px]"
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
	image,
	imageAlt,
}: FeatureBlockProps) {
	return (
		<section
			id={id}
			className="mx-auto flex w-full max-w-[1199px] items-center justify-center px-5 py-13 lg:px-0 lg:py-[138px]">
			<div
				className={`flex w-full flex-col items-center gap-8 lg:w-auto lg:gap-10 ${
					reversed ? "lg:flex-row-reverse" : "lg:flex-row"
				}`}>
				<FeatureCopy
					eyebrow={eyebrow}
					heading={heading}
					description={description}
					buttonLabel={buttonLabel}
					buttonTo={buttonTo}
				/>
				<FeatureImage image={image} imageAlt={imageAlt} />
				<div className="flex w-full justify-center lg:hidden">
					<CtaButton to={buttonTo}>{buttonLabel}</CtaButton>
				</div>
			</div>
		</section>
	);
}
