-- CreateTable
CREATE TABLE "TaskNote" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "author" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskNote_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TaskNote" ADD CONSTRAINT "TaskNote_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
