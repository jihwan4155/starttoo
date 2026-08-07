import Footer from "../components/home/Footer";
import type { LegalDocument } from "../constants/legal";

/**
 * 이용약관 · 개인정보처리방침 · 커뮤니티 가이드라인 공용 화면.
 *
 * 세 문서가 형태가 같아 화면은 하나만 두고 본문(constants/legal.ts)만 갈아 끼운다.
 * 문서끼리 오갈 수 있게 아래에 홈과 같은 푸터를 붙인다.
 */
export default function LegalPage({ doc }: { doc: LegalDocument }) {
	return (
		<div className="min-h-[calc(100vh-var(--nav-h))] bg-surface">
			<article className="mx-auto max-w-[820px] px-5 pb-16 pt-10 lg:pt-14">
				<h1 className="text-[26px] font-extrabold text-black lg:text-[32px]">
					{doc.title}
				</h1>
				<p className="mt-2 text-[13px] font-light text-black/45">
					시행일 {doc.effectiveDate}
				</p>

				{doc.intro && (
					<p className="mt-6 rounded-[12px] bg-white px-5 py-4 text-[14px] font-light leading-7 text-black/70 lg:text-[15px]">
						{doc.intro}
					</p>
				)}

				<div className="mt-10 space-y-9">
					{doc.sections.map((section) => (
						<section key={section.heading}>
							<h2 className="text-[17px] font-bold text-black lg:text-[19px]">
								{section.heading}
							</h2>
							{section.paragraphs?.map((paragraph) => (
								<p
									key={paragraph}
									className="mt-3 text-[14px] font-light leading-7 text-black/70 lg:text-[15px]">
									{paragraph}
								</p>
							))}
							{section.items && (
								<ul className="mt-3 space-y-2">
									{section.items.map((item) => (
										<li
											key={item}
											className="relative pl-4 text-[14px] font-light leading-7 text-black/70 lg:text-[15px]">
											{/* 목록 기호는 줄바꿈에도 첫 줄에 붙어 있어야 해서 직접 그린다 */}
											<span
												aria-hidden
												className="absolute left-0 top-[11px] h-[5px] w-[5px] rounded-full bg-brand/70"
											/>
											{item}
										</li>
									))}
								</ul>
							)}
						</section>
					))}
				</div>
			</article>
			<Footer />
		</div>
	);
}
