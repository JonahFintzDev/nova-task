-- CreateTable
CREATE TABLE "CalendarFeedList" (
    "feedId" TEXT NOT NULL,
    "listId" TEXT NOT NULL,

    CONSTRAINT "CalendarFeedList_pkey" PRIMARY KEY ("feedId","listId")
);

-- CreateIndex
CREATE INDEX "CalendarFeedList_listId_idx" ON "CalendarFeedList"("listId");

-- AddForeignKey
ALTER TABLE "CalendarFeedList" ADD CONSTRAINT "CalendarFeedList_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "CalendarFeedToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarFeedList" ADD CONSTRAINT "CalendarFeedList_listId_fkey" FOREIGN KEY ("listId") REFERENCES "List"("id") ON DELETE CASCADE ON UPDATE CASCADE;
