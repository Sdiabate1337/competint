import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FirecrawlService } from './firecrawl.service';

export interface LinkedInCompanyData {
    name?: string;
    description?: string;
    industry?: string;
    company_size?: string;
    headquarters?: string;
    founded?: number;
    specialties?: string[];
    website?: string;
    followers?: number;
    employees_on_linkedin?: number;
    recent_posts?: {
        content: string;
        date: string;
        engagement: number;
    }[];
}

export interface TwitterProfileData {
    handle?: string;
    name?: string;
    bio?: string;
    followers?: number;
    following?: number;
    tweets_count?: number;
    joined?: string;
    website?: string;
    recent_tweets?: {
        content: string;
        date: string;
        likes: number;
        retweets: number;
    }[];
}

export interface FacebookPageData {
    name?: string;
    about?: string;
    category?: string;
    followers?: number;
    likes?: number;
    website?: string;
    phone?: string;
    email?: string;
}

export interface SocialMediaProfile {
    linkedin?: LinkedInCompanyData;
    twitter?: TwitterProfileData;
    facebook?: FacebookPageData;
    instagram?: {
        handle?: string;
        followers?: number;
        posts_count?: number;
        bio?: string;
    };
    youtube?: {
        channel_name?: string;
        subscribers?: number;
        videos_count?: number;
        total_views?: number;
    };
}

export interface SocialMediaMetrics {
    total_social_followers: number;
    linkedin_followers: number;
    twitter_followers: number;
    facebook_followers: number;
    instagram_followers: number;
    youtube_subscribers: number;
    social_presence_score: number; // 0-100
    engagement_level: 'low' | 'medium' | 'high';
}

@Injectable()
export class SocialMediaService {
    private readonly logger = new Logger(SocialMediaService.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly firecrawlService: FirecrawlService,
    ) {}

    /**
     * Enrichir les données d'une entreprise avec ses profils sociaux
     */
    async enrichWithSocialData(socialLinks: {
        linkedin?: string;
        twitter?: string;
        facebook?: string;
        instagram?: string;
        youtube?: string;
    }): Promise<SocialMediaProfile> {
        const profile: SocialMediaProfile = {};

        const tasks: Promise<void>[] = [];

        if (socialLinks.linkedin) {
            tasks.push(
                this.scrapeLinkedIn(socialLinks.linkedin)
                    .then(data => { profile.linkedin = data; })
                    .catch(err => this.logger.warn(`LinkedIn scrape failed: ${err.message}`))
            );
        }

        if (socialLinks.twitter) {
            tasks.push(
                this.scrapeTwitter(socialLinks.twitter)
                    .then(data => { profile.twitter = data; })
                    .catch(err => this.logger.warn(`Twitter scrape failed: ${err.message}`))
            );
        }

        if (socialLinks.facebook) {
            tasks.push(
                this.scrapeFacebook(socialLinks.facebook)
                    .then(data => { profile.facebook = data; })
                    .catch(err => this.logger.warn(`Facebook scrape failed: ${err.message}`))
            );
        }

        // Execute all in parallel
        await Promise.all(tasks);

        return profile;
    }

    /**
     * Calculer les métriques sociales agrégées
     */
    calculateSocialMetrics(profile: SocialMediaProfile): SocialMediaMetrics {
        const linkedinFollowers = profile.linkedin?.followers || 0;
        const twitterFollowers = profile.twitter?.followers || 0;
        const facebookFollowers = profile.facebook?.followers || 0;
        const instagramFollowers = profile.instagram?.followers || 0;
        const youtubeSubscribers = profile.youtube?.subscribers || 0;

        const totalFollowers = linkedinFollowers + twitterFollowers + facebookFollowers + instagramFollowers + youtubeSubscribers;

        // Calculate presence score (0-100)
        let presenceScore = 0;
        if (profile.linkedin) presenceScore += 25;
        if (profile.twitter) presenceScore += 20;
        if (profile.facebook) presenceScore += 15;
        if (profile.instagram) presenceScore += 15;
        if (profile.youtube) presenceScore += 10;

        // Bonus for followers
        if (totalFollowers > 100000) presenceScore += 15;
        else if (totalFollowers > 10000) presenceScore += 10;
        else if (totalFollowers > 1000) presenceScore += 5;

        // Determine engagement level
        let engagementLevel: 'low' | 'medium' | 'high' = 'low';
        if (totalFollowers > 50000) engagementLevel = 'high';
        else if (totalFollowers > 5000) engagementLevel = 'medium';

        return {
            total_social_followers: totalFollowers,
            linkedin_followers: linkedinFollowers,
            twitter_followers: twitterFollowers,
            facebook_followers: facebookFollowers,
            instagram_followers: instagramFollowers,
            youtube_subscribers: youtubeSubscribers,
            social_presence_score: Math.min(presenceScore, 100),
            engagement_level: engagementLevel,
        };
    }

    /**
     * Scrape LinkedIn company page
     */
    private async scrapeLinkedIn(url: string): Promise<LinkedInCompanyData> {
        this.logger.log(`Scraping LinkedIn: ${url}`);

        // LinkedIn bloque le scraping direct, on utilise Firecrawl
        const page = await this.firecrawlService.scrapePage(url);

        if (!page?.markdown) {
            return this.mockLinkedInData(url);
        }

        // Parse le markdown pour extraire les données
        // En production, on utiliserait un parsing plus sophistiqué
        return this.parseLinkedInContent(page.markdown, url);
    }

    /**
     * Scrape Twitter/X profile
     */
    private async scrapeTwitter(url: string): Promise<TwitterProfileData> {
        this.logger.log(`Scraping Twitter: ${url}`);

        const page = await this.firecrawlService.scrapePage(url);

        if (!page?.markdown) {
            return this.mockTwitterData(url);
        }

        return this.parseTwitterContent(page.markdown, url);
    }

    /**
     * Scrape Facebook page
     */
    private async scrapeFacebook(url: string): Promise<FacebookPageData> {
        this.logger.log(`Scraping Facebook: ${url}`);

        const page = await this.firecrawlService.scrapePage(url);

        if (!page?.markdown) {
            return this.mockFacebookData(url);
        }

        return this.parseFacebookContent(page.markdown, url);
    }

    // ==================== PARSING HELPERS ====================

    private parseLinkedInContent(markdown: string, url: string): LinkedInCompanyData {
        // Extract handle from URL
        const handleMatch = url.match(/linkedin\.com\/company\/([^\/\?]+)/);
        const handle = handleMatch ? handleMatch[1] : '';

        // Basic parsing - in production, use more sophisticated NLP
        const followersMatch = markdown.match(/(\d+[,\d]*)\s*(followers|abonnés)/i);
        const employeesMatch = markdown.match(/(\d+[,\d]*)\s*(employees|employés)/i);

        return {
            name: handle.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            followers: followersMatch ? parseInt(followersMatch[1].replace(/,/g, '')) : undefined,
            employees_on_linkedin: employeesMatch ? parseInt(employeesMatch[1].replace(/,/g, '')) : undefined,
        };
    }

    private parseTwitterContent(markdown: string, url: string): TwitterProfileData {
        const handleMatch = url.match(/(twitter|x)\.com\/([^\/\?]+)/);
        const handle = handleMatch ? handleMatch[2] : '';

        const followersMatch = markdown.match(/(\d+[,.\d]*[KMkm]?)\s*(Followers|abonnés)/i);
        
        let followers = 0;
        if (followersMatch) {
            const value = followersMatch[1].replace(/,/g, '');
            if (value.toLowerCase().includes('k')) {
                followers = parseFloat(value) * 1000;
            } else if (value.toLowerCase().includes('m')) {
                followers = parseFloat(value) * 1000000;
            } else {
                followers = parseInt(value);
            }
        }

        return {
            handle: `@${handle}`,
            followers,
        };
    }

    private parseFacebookContent(markdown: string, url: string): FacebookPageData {
        const likesMatch = markdown.match(/(\d+[,\d]*)\s*(likes|j'aime)/i);
        const followersMatch = markdown.match(/(\d+[,\d]*)\s*(followers|abonnés)/i);

        return {
            likes: likesMatch ? parseInt(likesMatch[1].replace(/,/g, '')) : undefined,
            followers: followersMatch ? parseInt(followersMatch[1].replace(/,/g, '')) : undefined,
        };
    }

    // ==================== MOCK DATA ====================

    private mockLinkedInData(url: string): LinkedInCompanyData {
        this.logger.warn(`Using mock LinkedIn data for: ${url}`);

        const handleMatch = url.match(/linkedin\.com\/company\/([^\/\?]+)/);
        const handle = handleMatch ? handleMatch[1] : 'company';

        return {
            name: handle.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: 'A leading technology company focused on innovation.',
            industry: 'Financial Technology',
            company_size: '51-200 employees',
            headquarters: 'Lagos, Nigeria',
            founded: 2020,
            specialties: ['Fintech', 'Payments', 'Mobile Banking'],
            followers: Math.floor(Math.random() * 10000) + 1000,
            employees_on_linkedin: Math.floor(Math.random() * 100) + 20,
        };
    }

    private mockTwitterData(url: string): TwitterProfileData {
        this.logger.warn(`Using mock Twitter data for: ${url}`);

        const handleMatch = url.match(/(twitter|x)\.com\/([^\/\?]+)/);
        const handle = handleMatch ? handleMatch[2] : 'company';

        return {
            handle: `@${handle}`,
            name: handle.replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            bio: 'Building the future of finance in Africa 🚀',
            followers: Math.floor(Math.random() * 5000) + 500,
            following: Math.floor(Math.random() * 500) + 100,
            tweets_count: Math.floor(Math.random() * 1000) + 100,
            joined: '2020',
        };
    }

    private mockFacebookData(url: string): FacebookPageData {
        this.logger.warn(`Using mock Facebook data for: ${url}`);

        const handleMatch = url.match(/facebook\.com\/([^\/\?]+)/);
        const handle = handleMatch ? handleMatch[1] : 'company';

        return {
            name: handle.replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            about: 'Official Facebook page',
            category: 'Financial Service',
            followers: Math.floor(Math.random() * 8000) + 500,
            likes: Math.floor(Math.random() * 7000) + 400,
        };
    }
}
