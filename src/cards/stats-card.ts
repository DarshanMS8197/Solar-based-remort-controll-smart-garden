import _ from 'lodash';
import { calculateContributionRank } from '@/calculateContributionRank';
import { calculateRank } from '@/calculateRank';
import { Card } from '@/common/Card';
import { I18n } from '@/common/I18n';
import {
  clampValue,
  flexLayout,
  getCardColors,
  getImageBase64FromURL,
  measureText,
} from '@/common/utils';
import { getStyles } from '@/getStyles';
import { statCardLocales } from '@/translations';
import { Contributor, getContributors } from 'getContributors';

const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;

const createTextNode = ({ imageBase64, name, rank, contributionRank, index, height }) => {
  const staggerDelay = (index + 3) * 150;

  const calculateTextWidth = (text) => {
    return measureText(text, 18);
  };

  let offset = clampValue(calculateTextWidth(name), 230, 400);
  offset += offset === 230 ? 5 : 15;
  let offset2 = offset + 50;

  const contributionRankText = contributionRank?.includes('+')
    ? `<text x="4" y="18.5">
        ${contributionRank}
       </text>`
    : `<text x="7.2" y="18.5">
        ${contributionRank}
       </text>`;

  const rankText = rank.includes('+')
    ? `<text x="4" y="18.5">
        ${rank}
       </text>`
    : `<text x="7.2" y="18.5">
        ${rank}
       </text>`;

  let rankItems = _.isEmpty(contributionRank)
    ? `
    <g data-testid="rank-circle" transform="translate(${offset}, 0)">
      <circle class="rank-circle-rim" cx="12.5" cy="12.5" r="14" />
      <g class="rank-text">
        ${rankText}
      </g>
    </g>
    `
    : `
    <g data-testid="rank-circle" transform="translate(${offset}, 0)">
      <circle class="rank-circle-rim" cx="12.5" cy="12.5" r="14" />
      <g class="rank-text">${contributionRankText}</g>
    </g>
    <g data-testid="rank-circle" transform="translate(${offset2}, 0)">
      <circle class="rank-circle-rim" cx="12.5" cy="12.5" r="14" />
      <g class="rank-text">
        ${rankText}
      </g>
    </g>
    `;

  return `
    <g class="stagger" style="animation-delay: ${staggerDelay}ms" transform="translate(25, 0)">
      <defs>
        <clipPath id="myCircle">
          <circle cx="12.5" cy="12.5" r="12.5" fill="#FFFFFF" />
        </clipPath>
      </defs>
      <image xlink:href="${imageBase64}" width="25" height="25" clip-path="url(#myCircle)"/>
      <g transform="translate(30,16)">
        <text class="stat bold">${name}</text>
      </g>
      ${rankItems}
    </g>
  `;
};

export const renderContributorStatsCard = async (
  username,
  name,
  contributorStats = [] as any,
  options = {} as any,
) => {
  const {
    hide = [],
    line_height = 25,
    hide_title = false,
    hide_border = false,
    hide_contributor_rank = true,
    order_by = 'stars',
    title_color,
    icon_color,
    text_color,
    bg_color,
    border_radius,
    border_color,
    custom_title,
    theme = 'default',
    locale,
    limit = -1,
  } = options;

  const orderBy = order_by;
  const lheight = parseInt(String(line_height), 10);

  // returns theme based colors with proper overrides and defaults
  const { titleColor, textColor, iconColor, bgColor, borderColor } = getCardColors({
    title_color,
    icon_color,
    text_color,
    bg_color,
    border_color,
    theme,
  });

  const apostrophe = ['x', 's'].includes(name.slice(-1).toLocaleLowerCase()) ? '' : 's';
  const i18n = new I18n({
    locale,
    translations: statCardLocales({ name, apostrophe }),
  });

  const imageBase64s = await Promise.all(
    Object.keys(contributorStats).map((key, index) => {
      const url = new URL(contributorStats[key].owner.avatarUrl);
      url.searchParams.append('s', '50');
      return getImageBase64FromURL(url.toString());
    }),
  );

  let allContributorsByRepo: Contributor[][];
  if (!hide_contributor_rank) {
    allContributorsByRepo = await Promise.all(
      Object.keys(contributorStats).map((key, index) => {
        const nameWithOwner = contributorStats[key].nameWithOwner;
        return getContributors(username, nameWithOwner, token!);
      }),
    );
  }

  const rankValues = {
    'S+': 5,
    S: 4,
    'A+': 3,
    A: 2,
    'B+': 1,
    B: 0,
  };

  const sortFunction =
    orderBy == 'stars'
      ? (a, b) => b.stars - a.stars
      : (a, b) => rankValues[b.contributionRank] - rankValues[a.contributionRank];

  const transformedContributorStats = contributorStats
    .map((contributorStat, index) => {
      const { url, name, stargazerCount, numOfMyContributions } = contributorStat;

      if (hide_contributor_rank) {
        return {
          name: name,
          imageBase64: imageBase64s[index],
          url: url,
          stars: stargazerCount,
          rank: calculateRank(stargazerCount),
        };
      } else {
        return {
          name: name,
          imageBase64: imageBase64s[index],
          url: url,
          stars: stargazerCount,
          contributionRank: calculateContributionRank(
            name,
            allContributorsByRepo[index],
            numOfMyContributions,
          ),
          rank: calculateRank(stargazerCount),
        };
      }
    })
    .filter((repository) => !hide.includes(repository.rank))
    .sort(sortFunction);

  let statItems = Object.keys(transformedContributorStats).map((key, index) =>
    // create the text nodes, and pass index so that we can calculate the line spacing
    createTextNode({
      ...transformedContributorStats[key],
      index,
      lheight,
    }),
  );

  statItems = limit > 0 ? statItems.slice(0, limit) : statItems.slice();

  // Calculate the card height depending on how many items there are
  // but if rank circle is visible clamp the minimum height to `150`
  const distanceY = 8;
  let height = Math.max(30 + 45 + (statItems.length + 1) * (lheight + distanceY), 150);

  const cssStyles = getStyles({
    titleColor,
    textColor,
    iconColor,
    show_icons: true,
    progress: true,
  });

  const width = 495;

  const card = new Card({
    customTitle: custom_title,
    defaultTitle: i18n.t('statcard.title'),
    titlePrefixIcon: '',
    width,
    height,
    border_radius,
    colors: {
      titleColor,
      textColor,
      iconColor,
      bgColor,
      borderColor,
    },
  });

  card.setHideContributorRank(hide_contributor_rank);
  card.setHideBorder(hide_border);
  card.setHideTitle(hide_title);
  card.setCSS(cssStyles);

  return card.render(`
    <svg overflow="visible">
      ${flexLayout({
        items: statItems,
        gap: lheight + distanceY,
        direction: 'column',
      }).join('')}
    </svg>
  `);
};
