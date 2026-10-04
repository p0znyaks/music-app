import type { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1700000000000 implements MigrationInterface {
  name = "InitialSchema1700000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "roles" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "username" character varying NOT NULL, "email" character varying NOT NULL, "password_hash" character varying NOT NULL, "is_blocked" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "role_id" integer, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "clips" ("id" SERIAL NOT NULL, "track_id" character varying NOT NULL, "title" character varying NOT NULL, "artist" character varying NOT NULL, "thumbnail_url" character varying, "start_time" integer NOT NULL, "end_time" integer NOT NULL, "short_code" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" integer, CONSTRAINT "UQ_a933e0e6838502aca375a9de71f" UNIQUE ("short_code"), CONSTRAINT "PK_cdb959a37f95935a5d30460dc3c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "favorite_tracks" ("id" SERIAL NOT NULL, "track_id" character varying NOT NULL, "title" character varying NOT NULL, "artist" character varying NOT NULL, "thumbnail_url" character varying, "duration" integer, "added_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" integer, CONSTRAINT "PK_8d34ad5c55c7d5448fad8c4ced7" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "listen_history" ("id" SERIAL NOT NULL, "track_id" character varying NOT NULL, "title" character varying NOT NULL, "artist" character varying NOT NULL, "thumbnail_url" character varying, "duration" integer, "listened_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" integer, CONSTRAINT "PK_a843bc2e94502f8432de79783c3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "playlists" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" integer, CONSTRAINT "PK_a4597f4189a75d20507f3f7ef0d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "playlist_tracks" ("id" SERIAL NOT NULL, "track_id" character varying NOT NULL, "title" character varying NOT NULL, "artist" character varying NOT NULL, "thumbnail_url" character varying, "duration" integer, "added_at" TIMESTAMP NOT NULL DEFAULT now(), "playlist_id" integer, CONSTRAINT "PK_0f93b1a2df4de2e5b48c1459617" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "track_tags" ("id" SERIAL NOT NULL, "track_id" character varying NOT NULL, "title" character varying NOT NULL, "artist" character varying NOT NULL, "thumbnail_url" character varying, "tag" character varying NOT NULL, "added_at" TIMESTAMP NOT NULL DEFAULT now(), "user_id" integer, CONSTRAINT "PK_82814b03a02ca7574af95674114" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "clips" ADD CONSTRAINT "FK_64dabc2724586a260ce3c893208" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorite_tracks" ADD CONSTRAINT "FK_3af7a3ee5333d4db9a85133b87a" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "listen_history" ADD CONSTRAINT "FK_a56c8e49a0310e5804c4ccba3e7" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "playlists" ADD CONSTRAINT "FK_a3ea169575c25e5c55494d7f382" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "playlist_tracks" ADD CONSTRAINT "FK_7ef165e08a3b87eae8cf4275cda" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "track_tags" ADD CONSTRAINT "FK_67febdcc6d9fdda82f343b9e72d" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    // Base roles are part of the schema seed, not application startup.
    await queryRunner.query(
      `INSERT INTO "roles" ("id", "name") VALUES (1, 'guest'), (2, 'user')`,
    );
    await queryRunner.query(
      `SELECT setval(pg_get_serial_sequence('roles', 'id'), COALESCE((SELECT MAX(id) FROM roles), 1))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "track_tags" DROP CONSTRAINT "FK_67febdcc6d9fdda82f343b9e72d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "playlist_tracks" DROP CONSTRAINT "FK_7ef165e08a3b87eae8cf4275cda"`,
    );
    await queryRunner.query(
      `ALTER TABLE "playlists" DROP CONSTRAINT "FK_a3ea169575c25e5c55494d7f382"`,
    );
    await queryRunner.query(
      `ALTER TABLE "listen_history" DROP CONSTRAINT "FK_a56c8e49a0310e5804c4ccba3e7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "favorite_tracks" DROP CONSTRAINT "FK_3af7a3ee5333d4db9a85133b87a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "clips" DROP CONSTRAINT "FK_64dabc2724586a260ce3c893208"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1"`,
    );
    await queryRunner.query(`DROP TABLE "track_tags"`);
    await queryRunner.query(`DROP TABLE "playlist_tracks"`);
    await queryRunner.query(`DROP TABLE "playlists"`);
    await queryRunner.query(`DROP TABLE "listen_history"`);
    await queryRunner.query(`DROP TABLE "favorite_tracks"`);
    await queryRunner.query(`DROP TABLE "clips"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "roles"`);
  }
}
