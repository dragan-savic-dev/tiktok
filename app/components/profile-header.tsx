import type { TikTokUser } from "@/lib/types";
import { VerifiedIcon } from "./icons";

export default function ProfileHeader({ user }: { user: TikTokUser }) {
  const avatar = user.avatar_large_url ?? user.avatar_url;

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div className="relative">
        <div
          className="absolute -inset-1.5 rounded-full bg-gradient-to-tr from-tt-cyan via-tt-cyan/40 to-tt-pink opacity-80 blur-lg"
          aria-hidden="true"
        />
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar da CDN TikTok: domini variabili e URL a scadenza (~6h), non adatti a remotePatterns
          <img
            src={avatar}
            alt={user.display_name ?? "Avatar"}
            className="relative h-16 w-16 rounded-full border-2 border-black sm:h-20 sm:w-20 object-cover"
          />
        ) : (
          <div className="relative h-16 w-16 rounded-full border-2 border-black sm:h-20 sm:w-20 bg-zinc-800" />
        )}
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <div className="flex items-center gap-1.5">
          <h1 className="text-lg font-bold text-white sm:text-xl">
            {user.display_name ?? "Profilo TikTok"}
          </h1>
          {user.is_verified && <VerifiedIcon className="h-5 w-5 text-tt-cyan" />}
        </div>
        {user.username &&
          (user.profile_deep_link ? (
            <a
              href={user.profile_deep_link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-400 transition-colors hover:text-tt-cyan"
            >
              @{user.username}
            </a>
          ) : (
            <span className="text-sm text-zinc-400">@{user.username}</span>
          ))}
      </div>
    </div>
  );
}
