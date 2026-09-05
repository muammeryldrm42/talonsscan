import TokenView from "@/components/TokenView";
export default function Page({ params }: { params: { address: string } }) { return <TokenView address={params.address} />; }
