import { redirect } from "next/navigation";

// O duelo do Random acontece na mesma mesa do lobby (/duel/play). Esta rota só
// existe para que links antigos para /duel/<id> continuem funcionando.
export default function DuelRedirectPage({ params }: { params: { id: string } }) {
  redirect(`/duel/play?room=${encodeURIComponent(params.id)}`);
}
