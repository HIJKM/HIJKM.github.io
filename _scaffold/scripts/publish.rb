#!/usr/bin/env ruby

require "date"
require "fileutils"
require "yaml"

published_at = Time.now.getlocal("+09:00")
plans = []

Dir.glob("drafts/**/*.md").sort.each do |draft|
  source = File.read(draft, encoding: "UTF-8")
  front_matter = source.match(/\A---\r?\n(.*?)\r?\n---(?:\r?\n|\z)/m)
  raise "Unclosed front matter: #{draft}" if source.start_with?("---") && !front_matter
  next unless front_matter

  metadata = YAML.safe_load(front_matter[1], permitted_classes: [Date, Time], aliases: false) || {}
  raise "Invalid front matter: #{draft}" unless metadata.is_a?(Hash)
  next unless metadata["publish"] == true

  name = File.basename(draft, ".md")
  slug = name.gsub(/[^\p{L}\p{N}]+/u, "-").gsub(/\A-+|-+\z/, "").downcase
  raise "Invalid draft name: #{draft}" if slug.empty?

  metadata.delete("publish")
  metadata["title"] = name if !metadata["title"].is_a?(String) || metadata["title"].strip.empty?
  metadata["date"] = published_at.strftime("%Y-%m-%d %H:%M:%S %z")

  archive = File.join("archive", "posts", draft.delete_prefix("drafts/"))
  post = File.join("_posts", "#{published_at.strftime('%Y-%m-%d')}-#{slug}.md")
  raise "Archive already exists: #{archive}" if File.exist?(archive)
  raise "Post already exists: #{post}" if File.exist?(post)
  raise "Duplicate publication target: #{post}" if plans.any? { |plan| plan[:post] == post }

  plans << {
    draft: draft,
    archive: archive,
    post: post,
    content: YAML.dump(metadata) + "---\n" + source[front_matter.end(0)..-1]
  }
end

plans.each do |plan|
  FileUtils.mkdir_p(File.dirname(plan[:archive]))
  FileUtils.mkdir_p(File.dirname(plan[:post]))
  File.write(plan[:post], plan[:content])
  begin
    FileUtils.mv(plan[:draft], plan[:archive])
  rescue StandardError
    File.delete(plan[:post])
    raise
  end
  puts "Published #{plan[:post]} (original: #{plan[:archive]})"
end
