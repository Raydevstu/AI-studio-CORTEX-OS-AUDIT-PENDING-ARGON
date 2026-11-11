import { NextRequest } from "next/server";
import { POST as ingestSourcePost } from "@/app/api/sources/route";

export async function POST(req: NextRequest) {
  return ingestSourcePost(req);
}
