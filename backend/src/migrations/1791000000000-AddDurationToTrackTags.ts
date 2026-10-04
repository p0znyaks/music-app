import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `duration` to `track_tags`.
 *
 * Tag rows previously kept no length, so building a playlist by mood had to
 * read the value back out of `favorite_tracks` and `playlist_tracks` through two
 * extra joins. With the column here the lookup is a single read, and new rows
 * are written with their length like every other table.
 *
 * Existing rows are backfilled from those same tables, taking the longest known
 * length per track, so no tag row is left empty when its length is known.
 */
export class AddDurationToTrackTags1791000000000 implements MigrationInterface {
  name = 'AddDurationToTrackTags1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "track_tags" ADD "duration" integer`);

    // Longest known length wins: a track can sit in several playlists.
    await queryRunner.query(`
      UPDATE "track_tags" t
      SET "duration" = known.duration
      FROM (
        SELECT track_id, MAX(duration) AS duration
        FROM (
          SELECT track_id, duration FROM "favorite_tracks" WHERE duration IS NOT NULL AND duration > 0
          UNION ALL
          SELECT track_id, duration FROM "playlist_tracks" WHERE duration IS NOT NULL AND duration > 0
        ) AS candidates
        GROUP BY track_id
      ) AS known
      WHERE t.track_id = known.track_id AND (t.duration IS NULL OR t.duration <= 0)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "track_tags" DROP COLUMN "duration"`);
  }
}
