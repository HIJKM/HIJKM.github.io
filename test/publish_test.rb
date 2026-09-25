require "minitest/autorun"
require "fileutils"
require "open3"
require "tmpdir"
require "yaml"

class PublishTest < Minitest::Test
  SCRIPT = File.expand_path("../scripts/publish.rb", __dir__)

  def setup
    @root = Dir.mktmpdir("hijkm-publish-")
    FileUtils.mkdir_p(File.join(@root, "drafts"))
  end

  def teardown
    FileUtils.remove_entry(@root)
  end

  def test_publishes_checked_draft_and_preserves_original
    original = "---\npublish: true\ntags:\n  - 기록\n---\n안녕하세요.\n"
    File.write(File.join(@root, "drafts", "첫 글.md"), original)
    File.write(File.join(@root, "drafts", "보류.md"), "---\npublish: false\n---\n아직 작성 중.\n")

    output, status = run_publish

    assert status.success?, output
    assert_equal original, File.read(File.join(@root, "archive", "posts", "첫 글.md"))
    refute File.exist?(File.join(@root, "drafts", "첫 글.md"))
    assert File.exist?(File.join(@root, "drafts", "보류.md"))

    posts = Dir.glob(File.join(@root, "_posts", "*.md"))
    assert_equal 1, posts.length
    assert_match(/\A\d{4}-\d{2}-\d{2}-첫-글\.md\z/, File.basename(posts.first))
    published = File.read(posts.first)
    assert_match(/\A---\n.*\n---\n안녕하세요\.\n\z/m, published)
    metadata = YAML.safe_load(published.match(/\A---\n(.*?)\n---\n/m)[1])
    assert_equal "첫 글", metadata["title"]
    assert_equal ["기록"], metadata["tags"]
    refute metadata.key?("publish")
    assert_match(/\A\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} \+0900\z/, metadata.fetch("date"))

    output, status = run_publish
    assert status.success?, output
    assert_equal posts, Dir.glob(File.join(@root, "_posts", "*.md"))
  end

  def test_existing_archive_prevents_partial_publication
    File.write(File.join(@root, "drafts", "첫 글.md"), "---\npublish: true\n---\n새 글\n")
    archive = File.join(@root, "archive", "posts", "첫 글.md")
    FileUtils.mkdir_p(File.dirname(archive))
    File.write(archive, "기존 원문")

    output, status = run_publish

    refute status.success?, output
    assert_includes output, "archive"
    assert_equal "기존 원문", File.read(archive)
    assert File.exist?(File.join(@root, "drafts", "첫 글.md"))
    assert_empty Dir.glob(File.join(@root, "_posts", "*.md"))
  end

  private

  def run_publish
    stdout, stderr, status = Open3.capture3(RbConfig.ruby, SCRIPT, chdir: @root)
    [stdout + stderr, status]
  end
end
