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
		<div className="flex w-fit max-w-[650px] flex-col">
			<p className="whitespace-nowrap text-[24px] font-normal leading-7 text-black">
				{eyebrow}
			</p>
			<h2 className="mt-5 whitespace-nowrap text-[48px] font-extrabold leading-[57px] text-black">
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

function FeatureImage({ image, imageAlt }: { image: string; imageAlt: string }) {
	return (
		<img
			src={image}
			alt={imageAlt}
			className="h-[284px] w-[420px] shrink-0 rounded-[10px] object-cover"
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
			className="mx-auto flex w-full max-w-[1199px] items-center justify-center py-[138px]">
			<div
				className={`flex items-center gap-10 ${
					reversed ? "flex-row-reverse" : "flex-row"
				}`}>
				<FeatureCopy
					eyebrow={eyebrow}
					heading={heading}
					description={description}
					buttonLabel={buttonLabel}
					buttonTo={buttonTo}
				/>
				<FeatureImage image={image} imageAlt={imageAlt} />
			</div>
		</section>
	);
}
