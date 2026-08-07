import { Link } from "react-router-dom";
import { LEGAL_DOCUMENTS } from "../../constants/legal";

export default function Footer() {
	return (
		<footer className="border-t border-black/10 px-5 py-8 text-center lg:py-10">
			<div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-[12px] font-light text-black/50 lg:text-[14px]">
				{LEGAL_DOCUMENTS.map((doc, index) => (
					<span key={doc.path} className="flex items-center gap-x-3">
						{index > 0 && <span className="text-black/20">|</span>}
						<Link to={doc.path} className="transition hover:text-black">
							{doc.title}
						</Link>
					</span>
				))}
			</div>
			<p className="mt-3 text-[13px] font-light text-black/35">
				© 2026 Starttoo. All Rights Reserved.
			</p>
		</footer>
	);
}
